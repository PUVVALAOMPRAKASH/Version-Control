import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { getCurrentUser } from './authService';

export interface Repository {
  id?: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  collaborators?: string[];
  forkedFrom?: string;  // ID of the original repository this was forked from
}

// Create a new repository
export const createRepository = async (
  name: string,
  description: string,
  isPublic: boolean = false
): Promise<{ success: boolean; repository?: Repository; error?: string }> => {
  try {
    console.log("createRepository function called with:", { name, description, isPublic });
    
    const currentUser = getCurrentUser();
    console.log("Current user:", currentUser?.email);
    
    if (!currentUser) {
      console.error("No authenticated user found");
      return { success: false, error: 'User not authenticated' };
    }
    
    // Check if repository with same name already exists for this user
    const repoQuery = query(
      collection(db, "repositories"),
      where("ownerId", "==", currentUser.uid),
      where("name", "==", name)
    );
    
    console.log("Checking for existing repository with name:", name);
    const existingRepos = await getDocs(repoQuery);
    
    if (!existingRepos.empty) {
      console.error("Repository with same name already exists");
      return { 
        success: false, 
        error: 'A repository with this name already exists' 
      };
    }
    
    const timestamp = new Date().toISOString();
    
    const newRepository: Repository = {
      name,
      description,
      ownerId: currentUser.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
      isPublic,
      collaborators: []
    };
    
    console.log("Creating new repository document:", newRepository);
    const docRef = await addDoc(collection(db, "repositories"), newRepository);
    console.log("Repository created with ID:", docRef.id);
    
    return { 
      success: true, 
      repository: { 
        ...newRepository, 
        id: docRef.id 
      } 
    };
  } catch (error: any) {
    console.error("Error in createRepository:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to create repository' 
    };
  }
};

// Get all repositories for the current user
export const getUserRepositories = async (): Promise<
  { success: boolean; repositories?: Repository[]; error?: string }
> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get repositories where user is owner
    const ownerQuery = query(
      collection(db, "repositories"),
      where("ownerId", "==", currentUser.uid)
    );
    
    const ownerRepos = await getDocs(ownerQuery);
    
    // Get repositories where user is collaborator
    const collaboratorQuery = query(
      collection(db, "repositories"),
      where("collaborators", "array-contains", currentUser.uid)
    );
    
    const collaboratorRepos = await getDocs(collaboratorQuery);
    
    const repositories: Repository[] = [];
    
    ownerRepos.forEach((doc) => {
      repositories.push({ id: doc.id, ...doc.data() } as Repository);
    });
    
    collaboratorRepos.forEach((doc) => {
      // Avoid duplicates if user is both owner and collaborator
      if (!repositories.some(repo => repo.id === doc.id)) {
        repositories.push({ id: doc.id, ...doc.data() } as Repository);
      }
    });
    
    // Sort by recently updated
    repositories.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    return { success: true, repositories };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Failed to fetch repositories' 
    };
  }
};

// Get a specific repository by ID
export const getRepository = async (id: string): Promise<
  { success: boolean; repository?: Repository; error?: string }
> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const docRef = doc(db, "repositories", id);
    const repoDoc = await getDoc(docRef);
    
    if (!repoDoc.exists()) {
      return { success: false, error: 'Repository not found' };
    }
    
    const repository = { id: repoDoc.id, ...repoDoc.data() } as Repository;
    
    // For access requests, we need to allow reading the repository even if it's private
    // This is because we need the owner information to send the request
    // But we'll only return minimal information in this case
    if (!repository.isPublic && 
        repository.ownerId !== currentUser.uid && 
        !repository.collaborators?.includes(currentUser.uid)) {
      return { 
        success: true, 
        repository: {
          id: repository.id,
          name: repository.name,
          ownerId: repository.ownerId,
          isPublic: false,
          description: repository.description,
          createdAt: repository.createdAt,
          updatedAt: repository.updatedAt,
          collaborators: []
        }
      };
    }
    
    return { success: true, repository };
  } catch (error: any) {
    console.error("Error in getRepository:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch repository' 
    };
  }
};

// Update a repository
export const updateRepository = async (
  id: string,
  updates: Partial<Repository>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the repository to check ownership
    const { success, repository, error } = await getRepository(id);
    
    if (!success || !repository) {
      return { success: false, error: error || 'Repository not found' };
    }
    
    // Check if user is the owner
    if (repository.ownerId !== currentUser.uid) {
      return { success: false, error: 'Only the owner can update this repository' };
    }
    
    const docRef = doc(db, "repositories", id);
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Failed to update repository' 
    };
  }
};

// Get all public repositories from all users
export const getAllPublicRepositories = async (): Promise<
  { success: boolean; repositories?: Repository[]; error?: string }
> => {
  try {
    // Get all public repositories
    const publicReposQuery = query(
      collection(db, "repositories"),
      where("isPublic", "==", true)
    );
    
    const publicReposDocs = await getDocs(publicReposQuery);
    
    const repositories: Repository[] = [];
    
    publicReposDocs.forEach((doc) => {
      repositories.push({ id: doc.id, ...doc.data() } as Repository);
    });
    
    // Sort by recently updated
    repositories.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    return { success: true, repositories };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Failed to fetch public repositories' 
    };
  }
};

// Delete a repository
export const deleteRepository = async (id: string): Promise<
  { success: boolean; error?: string }
> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the repository to check ownership
    const { success, repository, error } = await getRepository(id);
    
    if (!success || !repository) {
      return { success: false, error: error || 'Repository not found' };
    }
    
    // Check if user is the owner
    if (repository.ownerId !== currentUser.uid) {
      return { success: false, error: 'Only the owner can delete this repository' };
    }
    
    const docRef = doc(db, "repositories", id);
    await deleteDoc(docRef);
    
    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Failed to delete repository' 
    };
  }
};

// Define Access Request status constants
export const ACCESS_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied'
};

// Function to request access to a private repository
export const requestRepositoryAccess = async (
  repositoryId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the repository to check if it exists and get owner information
    const { success, repository, error } = await getRepository(repositoryId);
    
    if (!success || !repository) {
      return { success: false, error: error || 'Repository not found' };
    }
    
    // Check if the user is already a collaborator
    if (repository.collaborators?.includes(currentUser.uid)) {
      return { success: false, error: 'You already have access to this repository' };
    }
    
    // Check if the user is the owner (shouldn't happen, but just in case)
    if (repository.ownerId === currentUser.uid) {
      return { success: false, error: 'You are the owner of this repository' };
    }
    
    // Check if there's an existing access request
    const accessRequestQuery = query(
      collection(db, "accessRequests"),
      where("repositoryId", "==", repositoryId),
      where("requesterId", "==", currentUser.uid),
      where("status", "==", ACCESS_REQUEST_STATUS.PENDING)
    );
    
    const existingRequests = await getDocs(accessRequestQuery);
    
    if (!existingRequests.empty) {
      return { success: false, error: 'You already have a pending access request for this repository' };
    }
    
    // Create a new access request
    const timestamp = new Date().toISOString();
    
    const newAccessRequest = {
      repositoryId,
      repositoryName: repository.name,
      ownerId: repository.ownerId,
      requesterId: currentUser.uid,
      requesterEmail: currentUser.email,
      requesterName: currentUser.displayName || currentUser.email?.split('@')[0] || currentUser.uid,
      status: ACCESS_REQUEST_STATUS.PENDING,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Add the access request to Firestore
    console.log("Creating access request:", newAccessRequest);
    const accessRequestRef = await addDoc(collection(db, "accessRequests"), newAccessRequest);
    console.log("Access request created with ID:", accessRequestRef.id);
    
    // Create a notification for the repository owner
    const { createNotification } = await import('./notificationService');
    
    const notificationDetails = {
      requesterId: currentUser.uid,
      requesterName: currentUser.displayName || currentUser.email,
      repositoryId,
      repositoryName: repository.name,
      requestId: accessRequestRef.id
    };
    
    console.log("Creating notification with details:", notificationDetails);
    
    const notificationResult = await createNotification(
      repository.ownerId,
      'access_request',
      `${currentUser.displayName || currentUser.email || 'A user'} has requested access to your repository: ${repository.name}`,
      notificationDetails
    );
    
    if (!notificationResult.success) {
      console.error("Failed to create notification:", notificationResult.error);
      // We'll still return success for the access request since it was created
      // but we'll include a warning about the notification
      return { 
        success: true, 
        error: 'Access request created, but notification to owner failed. Please contact the owner directly.' 
      };
    }
    
    console.log("Notification creation result:", notificationResult);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error requesting repository access:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to request repository access' 
    };
  }
};

// Function to handle access request approval or denial
export const updateAccessRequest = async (
  requestId: string,
  approve: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`Processing access request: ${requestId}, approve: ${approve}`);
    
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.error("No authenticated user found when processing request");
      return { success: false, error: 'User not authenticated' };
    }
    
    // Get the access request
    const requestRef = doc(db, "accessRequests", requestId);
    console.log("Fetching access request document...");
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      console.error(`Access request with ID ${requestId} not found`);
      return { success: false, error: 'Access request not found' };
    }
    
    const requestData = requestSnap.data();
    console.log("Access request data:", requestData);
    
    // Verify the request is for a repository owned by the current user
    if (requestData.ownerId !== currentUser.uid) {
      console.error(`Permission error: Current user (${currentUser.uid}) is not the owner (${requestData.ownerId})`);
      return { success: false, error: 'You do not have permission to update this access request' };
    }
    
    // Update the request status
    const status = approve ? ACCESS_REQUEST_STATUS.APPROVED : ACCESS_REQUEST_STATUS.DENIED;
    console.log(`Updating access request status to: ${status}`);
    await updateDoc(requestRef, {
      status,
      updatedAt: new Date().toISOString()
    });
    
    // If approved, add the requester as a collaborator
    if (approve) {
      console.log(`Updating repository collaborators to include: ${requestData.requesterId}`);
      const repoRef = doc(db, "repositories", requestData.repositoryId);
      const repoSnap = await getDoc(repoRef);
      
      if (!repoSnap.exists()) {
        console.error(`Repository with ID ${requestData.repositoryId} not found`);
        return { success: false, error: 'Repository not found' };
      }
      
      const repoData = repoSnap.data();
      const collaborators = repoData.collaborators || [];
      
      // Add requester to collaborators if not already present
      if (!collaborators.includes(requestData.requesterId)) {
        await updateDoc(repoRef, {
          collaborators: [...collaborators, requestData.requesterId]
        });
        console.log("Repository collaborators updated successfully");
      } else {
        console.log("User is already a collaborator, no update needed");
      }
    }
    
    // Create a notification for the requester
    const { createNotification } = await import('./notificationService');
    
    const message = approve
      ? `Your request to access the repository '${requestData.repositoryName}' has been approved`
      : `Your request to access the repository '${requestData.repositoryName}' has been denied`;
    
    const notificationDetails = {
      repositoryId: requestData.repositoryId,
      repositoryName: requestData.repositoryName,
      ownerId: requestData.ownerId
    };
    
    console.log(`Creating notification for requester (${requestData.requesterId}) with message: ${message}`);
    console.log("Notification details:", notificationDetails);
    
    const notificationResult = await createNotification(
      requestData.requesterId,
      approve ? 'access_request_approved' : 'access_request_denied',
      message,
      notificationDetails
    );
    
    console.log("Notification creation result:", notificationResult);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error updating access request:", error);
    return { 
      success: false, 
      error: error.message || 'Failed to update access request' 
    };
  }
};

// Update the searchRepositories function to include private repositories in search results
export const searchRepositories = async (
  searchQuery: string,
  options: {
    includeUserRepos?: boolean,
    includePublicRepos?: boolean,
    includePrivateCollaborations?: boolean,
    includeAllPrivateRepos?: boolean, // New option to include all private repos in search
    limitResults?: number,
    sortOption?: 'updated' | 'created' | 'relevance'
  } = {}
): Promise<{ success: boolean; repositories?: Repository[]; error?: string }> => {
  try {
    const {
      includeUserRepos = true,
      includePublicRepos = true,
      includePrivateCollaborations = true,
      includeAllPrivateRepos = true, // Default to true for the new option
      limitResults = 20,
      sortOption = 'updated'
    } = options;
    
    const currentUser = getCurrentUser();
    
    if (!currentUser && (includeUserRepos || includePrivateCollaborations)) {
      return { success: false, error: 'User not authenticated' };
    }
    
    let allAccessibleRepos: Repository[] = [];
    let publicRepos: Repository[] = [];
    let otherPrivateRepos: Repository[] = [];
    
    // Get all repositories the user has access to (owned + collaborations) if requested
    if ((includeUserRepos || includePrivateCollaborations) && currentUser) {
      try {
        const userReposResult = await getUserRepositories();
        if (userReposResult.success) {
          // getUserRepositories already includes both owned repos and collaborator repos
          allAccessibleRepos = userReposResult.repositories || [];
        }
      } catch (err) {
        console.error("Error fetching user repositories:", err);
        // Continue with empty repos
      }
    }
    
    // Get all public repositories if requested
    if (includePublicRepos) {
      try {
        const publicReposResult = await getAllPublicRepositories();
        if (publicReposResult.success) {
          // Filter out repositories already in allAccessibleRepos to avoid duplicates
          publicRepos = (publicReposResult.repositories || []).filter(repo => 
            !allAccessibleRepos.some(userRepo => userRepo.id === repo.id)
          );
        }
      } catch (err) {
        console.error("Error fetching public repositories:", err);
        // Continue with empty public repos - we'll just search user repos
      }
    }
    
    // Get all private repositories (that the user doesn't already have access to) if requested
    if (includeAllPrivateRepos && currentUser) {
      try {
        // Query for all private repositories
        const privateReposQuery = query(
          collection(db, "repositories"),
          where("isPublic", "==", false)
        );
        
        const privateReposDocs = await getDocs(privateReposQuery);
        
        privateReposDocs.forEach((doc) => {
          const repoData = doc.data() as Repository;
          const repoWithId = { id: doc.id, ...repoData };
          
          // Only include repositories that the user doesn't already have access to
          // and doesn't own
          if (!allAccessibleRepos.some(userRepo => userRepo.id === doc.id) && 
              repoData.ownerId !== currentUser.uid) {
            otherPrivateRepos.push(repoWithId);
          }
        });
      } catch (err) {
        console.error("Error fetching private repositories:", err);
        // Continue with empty private repos
      }
    }
    
    // Combine repositories
    const allRepos = [...allAccessibleRepos, ...publicRepos, ...otherPrivateRepos];
    
    // Filter by search query
    const searchQueryLower = searchQuery.toLowerCase();
    const filteredRepos = searchQuery ? allRepos.filter(repo => 
      repo.name.toLowerCase().includes(searchQueryLower) ||
      (repo.description && repo.description.toLowerCase().includes(searchQueryLower))
    ) : allRepos;
    
    // Sort repositories
    let sortedRepos = [...filteredRepos];
    
    if (sortOption === 'updated') {
      sortedRepos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sortOption === 'created') {
      sortedRepos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOption === 'relevance') {
      // Sort by relevance - user repos first, exact name matches next, then description matches
      sortedRepos.sort((a, b) => {
        // User's own repos should come first
        if (currentUser) {
          if (a.ownerId === currentUser.uid && b.ownerId !== currentUser.uid) return -1;
          if (a.ownerId !== currentUser.uid && b.ownerId === currentUser.uid) return 1;
        }
        
        // Exact name matches come next
        const aExactMatch = a.name.toLowerCase() === searchQueryLower;
        const bExactMatch = b.name.toLowerCase() === searchQueryLower;
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        // Then partial name matches
        const aNameMatch = a.name.toLowerCase().includes(searchQueryLower);
        const bNameMatch = b.name.toLowerCase().includes(searchQueryLower);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        // Finally, sort by update date
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }
    
    // Apply limit
    const limitedResults = limitResults > 0 ? sortedRepos.slice(0, limitResults) : sortedRepos;
    
    return { 
      success: true, 
      repositories: limitedResults,
      error: publicRepos.length === 0 && includePublicRepos ? 
        'Note: Public repositories could not be accessed due to permissions' : undefined
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Failed to search repositories' 
    };
  }
};

// Get a repository by owner username and repo name
export const getRepositoryByOwnerAndName = async (
  ownerUsername: string,
  repoName: string
): Promise<{ success: boolean; repository?: Repository; ownerId?: string; error?: string }> => {
  try {
    console.log("Getting repository by owner and name:", ownerUsername, repoName);
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // First, try to query public repositories - this should work with appropriate security rules
    try {
      console.log("Trying to query for public repositories");
      const publicReposQuery = query(
        collection(db, "repositories"),
        where("name", "==", repoName),
        where("isPublic", "==", true)
      );
      
      const publicReposSnapshot = await getDocs(publicReposQuery);
      console.log(`Found ${publicReposSnapshot.size} public repositories matching name`);
      
      // Check if any match the owner identifier
      for (const doc of publicReposSnapshot.docs) {
        const repoData = doc.data();
        const ownerMatches = 
          repoData.ownerId === ownerUsername || 
          repoData.ownerId.substring(0, 8) === ownerUsername;
        
        if (ownerMatches) {
          console.log("Found matching public repository");
          const repository = { id: doc.id, ...repoData } as Repository;
          return { 
            success: true, 
            repository,
            ownerId: repository.ownerId
          };
        }
      }
    } catch (publicError) {
      console.error("Error querying public repositories:", publicError);
    }
    
    // Try to find private repositories where user is a collaborator
    try {
      console.log("Trying to query for private repositories with collaborator access");
      const privateReposQuery = query(
        collection(db, "repositories"),
        where("name", "==", repoName),
        where("isPublic", "==", false),
        where("collaborators", "array-contains", currentUser.uid)
      );
      
      const privateReposSnapshot = await getDocs(privateReposQuery);
      console.log(`Found ${privateReposSnapshot.size} private repositories matching name with collaborator access`);
      
      // Check if any match the owner identifier
      for (const doc of privateReposSnapshot.docs) {
        const repoData = doc.data();
        const ownerMatches = 
          repoData.ownerId === ownerUsername || 
          repoData.ownerId.substring(0, 8) === ownerUsername;
        
        if (ownerMatches) {
          console.log("Found matching private repository with collaborator access");
          const repository = { id: doc.id, ...repoData } as Repository;
          return { 
            success: true, 
            repository,
            ownerId: repository.ownerId
          };
        }
      }
    } catch (privateError) {
      console.error("Error querying private repositories:", privateError);
    }
    
    // If we're dealing with the current user's repo, try to find it in their repositories
    if (currentUser && (
        currentUser.displayName === ownerUsername || 
        currentUser.email?.split('@')[0] === ownerUsername || 
        currentUser.uid.substring(0, 8) === ownerUsername
    )) {
      console.log("Looking for repository in current user's repositories");
      try {
        const result = await getUserRepositories();
        if (result.success && result.repositories) {
          const repo = result.repositories.find(r => 
            r.name.toLowerCase() === repoName.toLowerCase()
          );
          
          if (repo) {
            console.log("Found repository in user's repositories");
            return { 
              success: true, 
              repository: repo,
              ownerId: repo.ownerId
            };
          }
        }
      } catch (userRepoError) {
        console.error("Error accessing user repositories:", userRepoError);
      }
    }
    
    // If we couldn't find it through the approaches above, return an informative error
    console.log("Repository not found or insufficient permissions");
    return { 
      success: false, 
      error: 'Repository not found or you do not have permission to access it. Check if the repository exists and is public.' 
    };
  } catch (error: any) {
    console.error("Error in getRepositoryByOwnerAndName:", error);
    
    // Detect Firebase permission errors
    if (error.code === 'permission-denied' || 
        error.name === 'FirebaseError' || 
        error.message?.includes('permission') || 
        error.message?.includes('Permission')) {
      return { 
        success: false, 
        error: 'Missing or insufficient permissions to access this repository' 
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to get repository' 
    };
  }
};

// Fork a repository
export const forkRepository = async (
  sourceRepoId: string,
  newName?: string
): Promise<{ success: boolean; repository?: Repository; error?: string }> => {
  try {
    console.log("Starting repository fork process:", { sourceRepoId, newName });
    
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.error("Fork failed: User not authenticated");
      return { success: false, error: 'User not authenticated' };
    }
    
    console.log("Authenticated user:", currentUser.email);
    
    // Get the source repository
    console.log("Fetching source repository:", sourceRepoId);
    const sourceRepoResult = await getRepository(sourceRepoId);
    
    if (!sourceRepoResult.success || !sourceRepoResult.repository) {
      console.error("Fork failed: Source repository not found", sourceRepoResult.error);
      return { success: false, error: sourceRepoResult.error || 'Source repository not found' };
    }
    
    const sourceRepo = sourceRepoResult.repository;
    console.log("Source repository found:", sourceRepo.name);
    
    // Check if the source repo is public or the current user is a collaborator
    if (!sourceRepo.isPublic && 
        sourceRepo.ownerId !== currentUser.uid && 
        !sourceRepo.collaborators?.includes(currentUser.uid)) {
      console.error("Fork failed: Permission denied");
      return { success: false, error: 'You do not have permission to fork this repository' };
    }
    
    // Generate a new name if not provided
    const repoName = newName || `${sourceRepo.name}-fork`;
    console.log("New repository name:", repoName);
    
    // Check if repository with same name already exists for this user
    console.log("Checking for duplicate repository names");
    const repoQuery = query(
      collection(db, "repositories"),
      where("ownerId", "==", currentUser.uid),
      where("name", "==", repoName)
    );
    
    const existingRepos = await getDocs(repoQuery);
    
    if (!existingRepos.empty) {
      console.error("Fork failed: Repository with same name exists");
      return { 
        success: false, 
        error: 'A repository with this name already exists in your account' 
      };
    }
    
    const timestamp = new Date().toISOString();
    
    // Ensure collaborators is always an array
    const collaborators = Array.isArray(sourceRepo.collaborators) ? [] : [];
    
    // Create the new repository document
    const newRepository: Repository = {
      name: repoName,
      description: `Fork of ${sourceRepo.name}${sourceRepo.description ? `: ${sourceRepo.description}` : ''}`,
      ownerId: currentUser.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
      isPublic: false, // Forked repos start as private
      collaborators: collaborators,
      forkedFrom: sourceRepoId  // Store the source repository ID
    };
    
    console.log("Creating new repository document:", JSON.stringify(newRepository));
    
    try {
      // Create the repository in Firestore
      const docRef = await addDoc(collection(db, "repositories"), newRepository);
      console.log("Repository fork created successfully with ID:", docRef.id);
      
      // Return the new repository info
      return { 
        success: true, 
        repository: { 
          ...newRepository, 
          id: docRef.id 
        } 
      };
    } catch (firestoreError: any) {
      console.error("Firestore error creating repository document:", firestoreError);
      
      let errorMessage = 'Failed to create repository document';
      
      // Check for specific Firestore errors
      if (firestoreError.code === 'permission-denied') {
        errorMessage = 'Permission denied. Check your Firestore security rules.';
      } else if (firestoreError.code === 'invalid-argument') {
        errorMessage = 'Invalid data in repository. Check your repository structure.';
      } else if (firestoreError.name === 'FirebaseError') {
        errorMessage = `Firebase error: ${firestoreError.message}`;
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  } catch (error: any) {
    console.error("Unexpected error in forkRepository:", error);
    
    return { 
      success: false, 
      error: error.message || 'Failed to fork repository' 
    };
  }
}; 