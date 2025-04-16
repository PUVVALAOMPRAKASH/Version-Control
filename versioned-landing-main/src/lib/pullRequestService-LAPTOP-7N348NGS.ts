import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import { getCurrentUser } from './authService';

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
      changedFiles,
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

export const getPullRequests = async (
  repoId: string,
  isTarget: boolean = true
): Promise<{ success: boolean; pullRequests?: PullRequest[]; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Query pull requests where this repo is the target
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