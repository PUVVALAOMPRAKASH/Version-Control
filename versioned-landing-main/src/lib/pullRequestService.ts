import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, orderBy } from 'firebase/firestore';
import { getCurrentUser } from './authService';
import { getFileContent, uploadFileWithCommit } from './s3Service';
import { listRepositoryFiles } from './s3Service';

export interface PullRequest {
  id?: string;
  title: string;
  description: string;
  sourceRepoId: string;
  sourceRepoName: string;
  targetRepoId: string;
  targetRepoName: string;
  targetOwnerId: string;
  sourceBranch?: string;
  targetBranch?: string;
  status: 'open' | 'merged' | 'rejected' | 'closed';
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  changedFiles?: string[];
}

// Create a new pull request
export const createPullRequest = async (
  title: string,
  description: string,
  sourceRepoId: string,
  sourceRepoName: string,
  targetRepoId: string,
  targetRepoName: string,
  targetOwnerId: string,
  changedFiles: string[] = []
): Promise<{ success: boolean; pullRequest?: PullRequest; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // If no changed files are provided, calculate them
    let filesToChange = changedFiles;
    if (filesToChange.length === 0) {
      console.log("No changed files provided, calculating differences...");
      const changedFilesResult = await getChangedFiles(sourceRepoId, targetRepoId);
      
      if (changedFilesResult.success) {
        filesToChange = changedFilesResult.files || [];
        console.log(`Found ${filesToChange.length} changed files`);
      } else {
        console.warn("Failed to calculate changed files:", changedFilesResult.error);
        // Continue with empty array, but log the issue
      }
    }
    
    const timestamp = new Date().toISOString();
    
    const newPullRequest: PullRequest = {
      title,
      description,
      sourceRepoId,
      sourceRepoName,
      targetRepoId,
      targetRepoName,
      targetOwnerId,
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: {
        id: currentUser.uid,
        name: currentUser.displayName || 'Anonymous',
        email: currentUser.email || 'unknown',
      },
      changedFiles: filesToChange,
      sourceBranch: 'main', // Default branch names
      targetBranch: 'main',
    };
    
    const docRef = await addDoc(collection(db, "pullRequests"), newPullRequest);
    
    // Create a notification for the target repo owner
    await addDoc(collection(db, "notifications"), {
      userId: targetOwnerId,
      type: 'pull_request_created',
      message: `New pull request: ${title}`,
      details: {
        pullRequestId: docRef.id,
        sourceRepoName,
        targetRepoName
      },
      read: false,
      createdAt: timestamp
    });
    
    return { 
      success: true, 
      pullRequest: { 
        ...newPullRequest, 
        id: docRef.id 
      } 
    };
  } catch (error: any) {
    console.error("Error creating pull request:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to create pull request' 
    };
  }
};

// Get pull requests for a repository (either as source or target)
export const getPullRequests = async (
  repoId: string,
  isTarget: boolean = true
): Promise<{ success: boolean; pullRequests?: PullRequest[]; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Query pull requests where this repo is the target or source
    const prQuery = isTarget 
      ? query(
          collection(db, "pullRequests"),
          where("targetRepoId", "==", repoId),
          orderBy("createdAt", "desc")
        )
      : query(
          collection(db, "pullRequests"),
          where("sourceRepoId", "==", repoId),
          orderBy("createdAt", "desc")
        );
    
    const prSnapshot = await getDocs(prQuery);
    
    const pullRequests: PullRequest[] = [];
    
    prSnapshot.forEach((doc) => {
      pullRequests.push({ id: doc.id, ...doc.data() } as PullRequest);
    });
    
    return { success: true, pullRequests };
  } catch (error: any) {
    console.error("Error fetching pull requests:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch pull requests' 
    };
  }
};

// Get a single pull request by ID
export const getPullRequest = async (
  pullRequestId: string
): Promise<{ success: boolean; pullRequest?: PullRequest; error?: string }> => {
  try {
    const docRef = doc(db, "pullRequests", pullRequestId);
    const prDoc = await getDoc(docRef);
    
    if (!prDoc.exists()) {
      return { success: false, error: 'Pull request not found' };
    }
    
    const pullRequest = { id: prDoc.id, ...prDoc.data() } as PullRequest;
    
    return { success: true, pullRequest };
  } catch (error: any) {
    console.error("Error fetching pull request:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch pull request' 
    };
  }
};

// Update the status of a pull request
export const updatePullRequestStatus = async (
  pullRequestId: string,
  status: PullRequest['status'],
  comment?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the pull request to check permissions
    const { success, pullRequest, error } = await getPullRequest(pullRequestId);
    
    if (!success || !pullRequest) {
      return { success: false, error: error || 'Pull request not found' };
    }
    
    // Check if user is the target repo owner (only they can accept/reject)
    if (pullRequest.targetOwnerId !== currentUser.uid && status !== 'closed') {
      return { 
        success: false, 
        error: 'Only the repository owner can update this pull request' 
      };
    }
    
    const docRef = doc(db, "pullRequests", pullRequestId);
    
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
    
    // Create a notification for the PR creator
    await addDoc(collection(db, "notifications"), {
      userId: pullRequest.createdBy.id,
      type: `pull_request_${status}`,
      message: `Your pull request "${pullRequest.title}" was ${status}`,
      details: {
        pullRequestId,
        comment: comment || '',
        targetRepoName: pullRequest.targetRepoName
      },
      read: false,
      createdAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Error updating pull request:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to update pull request' 
    };
  }
};

// Merge a pull request
export const mergePullRequest = async (
  pullRequestId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the pull request
    const { success, pullRequest, error } = await getPullRequest(pullRequestId);
    
    if (!success || !pullRequest) {
      return { success: false, error: error || 'Pull request not found' };
    }
    
    // Check if the user is authorized (must be target repo owner)
    if (pullRequest.targetOwnerId !== currentUser.uid) {
      return { 
        success: false, 
        error: 'Only the repository owner can merge this pull request' 
      };
    }
    
    // Check if PR is already closed
    if (pullRequest.status !== 'open') {
      return { 
        success: false, 
        error: `This pull request is already ${pullRequest.status}` 
      };
    }
    
    // Get the changed files - either from the PR object or by calculating them
    let changedFiles = pullRequest.changedFiles || [];
    
    // If no changed files are stored in the PR, calculate them now
    if (changedFiles.length === 0) {
      console.log("No changed files found in pull request, calculating differences...");
      const changedFilesResult = await getChangedFiles(pullRequest.sourceRepoId, pullRequest.targetRepoId);
      
      if (!changedFilesResult.success) {
        console.error("Failed to get changed files:", changedFilesResult.error);
        return { 
          success: false, 
          error: changedFilesResult.error || 'Failed to determine changed files' 
        };
      }
      
      changedFiles = changedFilesResult.files || [];
      console.log(`Found ${changedFiles.length} changed files`);
    }
    
    // If there are still no changed files, log a warning but proceed
    if (changedFiles.length === 0) {
      console.warn("No changed files found to merge for PR:", pullRequestId);
    }
    
    // Transfer each changed file from source to target repository
    let filesMerged = 0;
    for (const fileName of changedFiles) {
      try {
        // Get file content from the source repository
        const sourceFileResult = await getFileContent(pullRequest.sourceRepoId, fileName);
        
        if (!sourceFileResult.success || !sourceFileResult.content) {
          console.error(`Failed to get content for file ${fileName}:`, sourceFileResult.error);
          continue;
        }
        
        // Upload the file to the target repository
        const uploadResult = await uploadFileWithCommit(
          pullRequest.targetRepoId,
          fileName,
          sourceFileResult.content,
          `Merge PR #${pullRequestId.substring(0, 8)}: ${pullRequest.title}`,
          currentUser
        );
        
        if (uploadResult.success) {
          filesMerged++;
        }
      } catch (fileError: any) {
        console.error(`Error processing file ${fileName}:`, fileError);
      }
    }
    
    console.log(`Successfully merged ${filesMerged} out of ${changedFiles.length} files`);
    
    // Update the pull request status to merged
    await updatePullRequestStatus(pullRequestId, 'merged', comment);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error merging pull request:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to merge pull request' 
    };
  }
};

// Get the list of changed files between source and target repos
export const getChangedFiles = async (
  sourceRepoId: string, 
  targetRepoId: string
): Promise<{ success: boolean; files?: string[]; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // List all files in source repo
    const sourceFilesResult = await listRepositoryFiles(sourceRepoId);
    if (!sourceFilesResult.success) {
      return { 
        success: false, 
        error: sourceFilesResult.error || 'Failed to list source repository files' 
      };
    }
    
    // List all files in target repo
    const targetFilesResult = await listRepositoryFiles(targetRepoId);
    if (!targetFilesResult.success) {
      return { 
        success: false, 
        error: targetFilesResult.error || 'Failed to list target repository files' 
      };
    }
    
    const sourceFiles = sourceFilesResult.files || [];
    const targetFiles = targetFilesResult.files || [];
    
    // Create maps for easier comparison
    const sourceFileMap = new Map(sourceFiles.map(file => [file.name, file]));
    const targetFileMap = new Map(targetFiles.map(file => [file.name, file]));
    
    // Find files that are new or modified in source compared to target
    const changedFiles: string[] = [];
    
    // Check each source file
    for (const sourceFile of sourceFiles) {
      const fileName = sourceFile.name;
      const targetFile = targetFileMap.get(fileName);
      
      // If file doesn't exist in target or has different lastModified time, it's changed
      if (!targetFile || sourceFile.lastModified !== targetFile.lastModified) {
        changedFiles.push(fileName);
      }
    }
    
    return { 
      success: true, 
      files: changedFiles
    };
  } catch (error: any) {
    console.error("Error getting changed files:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to get changed files' 
    };
  }
}; 