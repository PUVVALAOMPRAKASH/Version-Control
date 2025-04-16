import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  getUserRepositories, 
  Repository, 
  getRepositoryByOwnerAndName,
  forkRepository,
  deleteRepository
} from "@/lib/repositoryService";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Upload,
  Download,
  FolderGit2,
  Globe,
  Lock,
  Clock,
  AlertCircle,
  FileIcon,
  HistoryIcon,
  PlusIcon,
  FileUpIcon,
  X,
  FileText,
  GitFork,
  GitCommit,
  GitPullRequest,
  Trash2,
  ClipboardCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  uploadFileToS3, 
  listRepositoryFiles,
  deleteFileFromS3,
  copyRepositoryFiles,
  listFileCommits
} from "@/lib/s3Service";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FileInfo {
  name: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: Date;
  downloadUrl: string;
}

const RepositoryDetails = () => {
  const params = useParams<{ username: string, repoName: string }>();
  const { username, repoName } = params;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isUserRepo, setIsUserRepo] = useState(false);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [forkName, setForkName] = useState("");
  const [isForking, setIsForking] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileHistory, setFileHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteRepoDialog, setShowDeleteRepoDialog] = useState(false);
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);

  console.log("RepositoryDetails component rendering with params:", { username, repoName });
  console.log("Full URL params:", window.location.pathname);
  console.log("Current user:", currentUser?.email);

  useEffect(() => {
    const loadRepository = async () => {
      if (!username || !repoName) {
        console.error("No username or repository name provided in params");
        setError("Repository information is missing from the URL");
        setIsLoading(false);
        return;
      }

      console.log(`Loading repository: ${username}/${repoName}`);

      try {
        let repo: Repository | null = null;
        
        // Check if this is the current user's repository
        const isCurrentUser = currentUser && (
          currentUser.displayName === username || 
          currentUser.email?.split('@')[0] === username || 
          currentUser.uid.substring(0, 8) === username
        );
        
        if (isCurrentUser) {
          // It's the current user's repo, use getUserRepositories
          console.log("Trying to load as current user's repository");
          const result = await getUserRepositories();
          console.log("User repositories result:", result);

          if (!result.success || !result.repositories) {
            console.error("Failed to load repositories:", result.error);
            setError(result.error || "Failed to load repositories");
            setIsLoading(false);
            return;
          }

          // Find the repository by name
          repo = result.repositories.find(r => r.name.toLowerCase() === repoName.toLowerCase()) || null;
          setIsUserRepo(true);
        } else {
          // It's another user's repo, use getRepositoryByOwnerAndName
          console.log("Trying to load as another user's repository");
          const result = await getRepositoryByOwnerAndName(username, repoName);
          console.log("Repository by owner/name result:", result);
          
          if (!result.success || !result.repository) {
            console.error("Failed to load repository:", result.error);
            setError(result.error || "Repository not found or you don't have access");
            setIsLoading(false);
            return;
          }
          
          repo = result.repository;
          setIsUserRepo(false);
        }
        
        if (!repo) {
          console.error(`Repository '${repoName}' not found`);
          setError(`Repository '${repoName}' not found`);
          setIsLoading(false);
          return;
        }

        console.log("Successfully found repository:", repo);
        setRepository(repo);
        loadFiles(repo);
      } catch (err: any) {
        console.error("Error loading repository:", err);
        setError(err.message || "An unexpected error occurred");
        setIsLoading(false);
      }
    };

    loadRepository();
  }, [username, repoName, currentUser]);

  const loadFiles = async (repo: Repository) => {
    if (!currentUser || !repo.id) {
      console.error("No authenticated user or repository ID");
      setIsLoading(false);
      return;
    }

    try {
      console.log("Loading files for repository:", repo.id);
      
      // Use S3 service to list files in the repository
      const result = await listRepositoryFiles(repo.id);
      
      if (!result.success) {
        console.error("Failed to list files:", result.error);
        toast({
          title: "Warning",
          description: "Could not load files from this repository",
          variant: "destructive"
        });
        setFiles([]);
        setIsLoading(false);
        return;
      }
      
      console.log("Files from S3:", result.files);
      
      if (!result.files || result.files.length === 0) {
        console.log("No files found in repository");
        setFiles([]);
        setIsLoading(false);
        return;
      }
      
      // Sort files by creation date (newest first)
      const sortedFiles = result.files.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setFiles(sortedFiles);
    } catch (err: any) {
      console.error("Error loading files:", err);
      toast({
        title: "Warning",
        description: "Could not load files from this repository",
        variant: "destructive"
      });
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // Validate required data
    if (!file) {
      console.error("No file selected");
      toast({
        title: "Upload error",
        description: "No file selected",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentUser) {
      console.error("No authenticated user");
      toast({
        title: "Authentication error",
        description: "You must be logged in to upload files",
        variant: "destructive",
      });
      return;
    }
    
    if (!repository?.id) {
      console.error("No repository ID available");
      toast({
        title: "Repository error",
        description: "Repository information is missing",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    console.log("Starting file upload:", file.name, "size:", file.size, "type:", file.type);
    
    // Determine the content type
    const contentType = file.type || "application/octet-stream";

    // Upload the file to S3
    const uploadTask = async () => {
      try {
        // Create a simulated progress indicator (S3 SDK doesn't provide progress)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (!prev) return 10;
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90; // Hold at 90% until complete
            }
            return prev + 10;
          });
        }, 500);
        
        // For small text files, directly use string content
        if ((contentType.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || 
             file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.jsx') || 
             file.name.endsWith('.tsx') || file.name.endsWith('.html') || file.name.endsWith('.css')) && 
            file.size < 1024 * 1024) {
          
          console.log("Reading as text file");
          try {
            const text = await file.text();
            console.log("Text file read, length:", text.length);
            
            // Upload to S3 as text
            const result = await uploadFileToS3(repository.id, file.name, text, contentType);
            
            clearInterval(progressInterval);
            
            if (!result.success) {
              console.error("Text upload failed:", result.error, "Details:", result.details);
              throw new Error(result.error || "Upload failed");
            }
            
            console.log("Text upload complete!", result);
            finishUpload(file.name);
          } catch (textError) {
            console.error("Error reading/uploading text file:", textError);
            clearInterval(progressInterval);
            handleUploadError(textError);
          }
          return;
        }
        
        // For binary files, use ArrayBuffer
        console.log("Reading file as ArrayBuffer");
        const reader = new FileReader();
        
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result;
            if (!arrayBuffer || typeof arrayBuffer === 'string') {
              throw new Error("Failed to read file data");
            }
            
            console.log("File read complete, uploading binary data to S3, size:", arrayBuffer.byteLength);
            
            // Upload to S3
            const result = await uploadFileToS3(repository.id, file.name, arrayBuffer, contentType);
            
            clearInterval(progressInterval);
            
            if (!result.success) {
              console.error("Binary upload failed:", result.error, "Details:", result.details);
              
              // Check for specific error types
              if (result.details?.code === 'NoSuchBucket') {
                throw new Error(`Bucket '${result.details.bucketName}' not found. Check your AWS configuration.`);
              } else if (result.error?.includes('CORS')) {
                throw new Error("CORS policy error. Your S3 bucket needs CORS configuration.");
              } else {
                throw new Error(result.error || "Upload failed");
              }
            }
            
            console.log("Binary upload complete!");
            finishUpload(file.name);
          } catch (error) {
            handleUploadError(error);
          }
        };
        
        reader.onerror = (error) => {
          clearInterval(progressInterval);
          console.error("Error reading file:", error);
          handleUploadError(new Error("Failed to read file"));
        };
        
        reader.readAsArrayBuffer(file);
      } catch (error) {
        handleUploadError(error);
      }
    };
    
    const finishUpload = (fileName: string) => {
      setIsUploading(false);
      setUploadProgress(100);
      
      // Wait a moment to show 100% before clearing
      setTimeout(() => {
        setUploadProgress(null);
        setShowUploadDialog(false);
        
        toast({
          title: "File uploaded",
          description: `${fileName} has been uploaded successfully.`,
        });
        
        // Refresh file list
        if (repository) {
          loadFiles(repository);
        }
        
        // Reset file input
        e.target.value = "";
      }, 500);
    };
    
    const handleUploadError = (error: any) => {
      console.error("Upload error:", error);
      setIsUploading(false);
      setUploadProgress(null);
      
      // Check for specific error types
      if (error.message?.includes('CORS') || error.name === 'NetworkError') {
        toast({
          title: "CORS Error",
          description: "Your S3 bucket needs CORS configuration. See AWS Setup guide for details.",
          variant: "destructive",
        });
      } else if (error.message?.includes('bucket')) {
        toast({
          title: "S3 Bucket Error",
          description: error.message || "Your S3 bucket is not properly configured.",
          variant: "destructive",
        });
      } else if (error.message?.includes('credential') || error.message?.includes('access key')) {
        toast({
          title: "AWS Credentials Error",
          description: "Your AWS credentials are invalid or missing.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Upload failed",
          description: error.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    };

    // Start the upload
    uploadTask();
  };

  const createNewFile = async () => {
    if (!newFileName || !currentUser || !repository?.id) {
      toast({
        title: "Error",
        description: "Please provide a file name",
        variant: "destructive",
      });
      return;
    }

    // Add file extension if not provided
    let fileName = newFileName;
    if (!fileName.includes('.')) {
      fileName += '.txt';
    }

    try {
      setIsCreatingFile(true);
      
      // Create a simulated progress indicator
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (!prev) return 10;
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Hold at 90% until complete
          }
          return prev + 10;
        });
      }, 300);
      
      // Upload the file content to S3
      const result = await uploadFileToS3(
        repository.id,
        fileName,
        newFileContent,
        'text/plain'
      );
      
      // Clear the interval and set to 100%
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // File creation completed successfully
      console.log("File creation complete!");
      setIsCreatingFile(false);
      setUploadProgress(null);
      setShowUploadDialog(false);
      setNewFileName("");
      setNewFileContent("");
      
      toast({
        title: "File created",
        description: `${fileName} has been created successfully.`,
      });
      
      // Refresh file list
      if (repository) {
        loadFiles(repository);
      }
    } catch (err: any) {
      console.error("Error creating file:", err);
      setIsCreatingFile(false);
      setUploadProgress(null);
      toast({
        title: "Creation failed",
        description: err.message || "Failed to create file. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to download a single file
  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      console.log("Downloading file:", fileName, "from URL:", fileUrl);
      
      // Fetch the file content
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download ${fileName}`);
      }
      
      // Get the file as blob
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      
      // Add to DOM, click, and remove
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      
      // Release the blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast({
        title: "Download started",
        description: `Downloading ${fileName}`,
      });
    } catch (err) {
      console.error("Error downloading file:", err);
      toast({
        title: "Download failed",
        description: "Could not download the file",
        variant: "destructive",
      });
    }
  };

  // Function to download the entire repository as a zip file
  const downloadRepository = async () => {
    if (files.length === 0) {
      toast({
        title: "No files to download",
        description: "This repository has no files to download",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsDownloading(true);
      toast({
        title: "Preparing download",
        description: "Creating zip file of all repository files...",
      });

      // Create a new JSZip instance
      const zip = new JSZip();
      
      // Track download progress
      let downloadedCount = 0;
      const totalFiles = files.length;
      
      // Create a promise for each file download
      const downloadPromises = files.map(async (file) => {
        try {
          // Fetch the file content
          const response = await fetch(file.downloadUrl);
          if (!response.ok) {
            throw new Error(`Failed to download ${file.name}`);
          }
          
          // Get the file as blob
          const blob = await response.blob();
          
          // Add file to the zip
          zip.file(file.name, blob);
          
          // Update progress
          downloadedCount++;
          setUploadProgress(Math.floor((downloadedCount / totalFiles) * 100));
          
          return true;
        } catch (error) {
          console.error(`Error downloading file ${file.name}:`, error);
          return false;
        }
      });
      
      // Wait for all downloads to complete
      await Promise.all(downloadPromises);
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Save the zip file
      saveAs(zipBlob, `${repository.name}.zip`);
      
      toast({
        title: "Download complete",
        description: `All files downloaded as ${repository.name}.zip`,
      });
    } catch (err) {
      console.error("Error downloading repository:", err);
      toast({
        title: "Download failed",
        description: "Could not download repository files",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
      setUploadProgress(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Handle forking a repository
  const handleFork = async () => {
    if (!repository || !repository.id || !currentUser) return;
    
    setForkName(`${repository.name}-fork`);
    setShowForkDialog(true);
  };
  
  const executeFork = async () => {
    if (!repository || !repository.id || !currentUser) return;
    
    setIsForking(true);
    
    try {
      console.log("Starting fork process for repository:", repository.id);
      
      // Create the fork in Firestore
      const forkResult = await forkRepository(repository.id, forkName);
      
      if (!forkResult.success || !forkResult.repository) {
        console.error("Fork failed:", forkResult.error);
        throw new Error(forkResult.error || "Failed to fork repository");
      }
      
      console.log("Fork created successfully:", forkResult.repository.id);
      
      // Copy files from source to fork
      try {
        const copyResult = await copyRepositoryFiles(repository.id, forkResult.repository.id);
        
        // Display success or warning message
        if (copyResult.success) {
          toast({
            title: "Repository forked successfully",
            description: copyResult.error ? 
              `${copyResult.filesCopied} files copied. ${copyResult.error}` : 
              `${copyResult.filesCopied} files copied to your new repository.`,
            variant: copyResult.error ? "destructive" : "default"
          });
          
          // Navigate to the new repository
          setTimeout(() => {
            navigate(`/${currentUser.displayName || currentUser.email?.split('@')[0] || currentUser.uid.substring(0, 8)}/${forkResult.repository?.name}`);
          }, 1000);
        } else {
          throw new Error(copyResult.error || "Failed to copy repository files");
        }
      } catch (copyError: any) {
        console.error("Error copying files:", copyError);
        
        // If we failed to copy files but created the repository, still show partial success
        toast({
          title: "Repository created but file copying failed",
          description: "Your fork was created, but we couldn't copy the files. You may need to add files manually.",
          variant: "destructive"
        });
        
        // Navigate to the new repository anyway
        setTimeout(() => {
          navigate(`/${currentUser.displayName || currentUser.email?.split('@')[0] || currentUser.uid.substring(0, 8)}/${forkResult.repository?.name}`);
        }, 1000);
      }
    } catch (error: any) {
      console.error("Error forking repository:", error);
      
      // Check if it's a Firestore 400 error
      if (error.name === 'FirebaseError' && (error.code === 'permission-denied' || error.message?.includes('400'))) {
        toast({
          title: "Firebase Permission Error",
          description: "You don't have permission to create repositories. Check your Firebase security rules.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Fork failed",
          description: error.message || "Failed to fork repository",
          variant: "destructive"
        });
      }
    } finally {
      setIsForking(false);
      setShowForkDialog(false);
    }
  };

  const fetchFileHistory = async (fileName: string) => {
    if (!repository?.id || !fileName) return;
    
    // Navigate to the file history page
    toast({
      title: "Opening file history",
      description: `Loading history for ${fileName}...`,
      duration: 3000, 
    });
    
    // Use same navigation pattern as the edit button
    setTimeout(() => {
      navigate(`/${username}/${repoName}/history/${fileName}`);
    }, 50);
  };

  // Function to handle file deletion
  const handleDeleteFile = async () => {
    if (!fileToDelete || !repository?.id) return;
    
    setIsDeleting(true);
    
    try {
      console.log(`Deleting file: ${fileToDelete.name} from repository: ${repository.id}`);
      
      // Call the deleteFileFromS3 function
      const result = await deleteFileFromS3(repository.id, fileToDelete.name);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to delete file");
      }
      
      // Close dialog and refresh file list
      setShowDeleteDialog(false);
      setFileToDelete(null);
      
      toast({
        title: "File deleted",
        description: `${fileToDelete.name} has been deleted successfully.`,
      });
      
      // Refresh file list
      loadFiles(repository);
    } catch (err: any) {
      console.error("Error deleting file:", err);
      toast({
        title: "Delete failed",
        description: err.message || "Failed to delete file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to open the delete confirmation dialog
  const confirmDeleteFile = (file: FileInfo) => {
    setFileToDelete(file);
    setShowDeleteDialog(true);
  };

  // Function to handle repository deletion
  const handleDeleteRepository = async () => {
    if (!repository?.id) return;
    
    setIsDeletingRepo(true);
    
    try {
      console.log(`Deleting repository: ${repository.id}`);
      
      // Call the deleteRepository function
      const result = await deleteRepository(repository.id);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to delete repository");
      }
      
      // Show success message and navigate to home
      toast({
        title: "Repository deleted",
        description: `${repository.name} has been deleted successfully.`,
      });
      
      // Navigate to home after a short delay
      setTimeout(() => {
        navigate('/home');
      }, 1000);
      
    } catch (err: any) {
      console.error("Error deleting repository:", err);
      toast({
        title: "Delete failed",
        description: err.message || "Failed to delete repository. Please try again.",
        variant: "destructive",
      });
      setIsDeletingRepo(false);
      setShowDeleteRepoDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-red-500 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Repository Error</h1>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Debug Information</h2>
            <div className="space-y-1 text-xs text-gray-600">
              <p><span className="font-medium">Username:</span> {username}</p>
              <p><span className="font-medium">Repository:</span> {repoName}</p>
              <p><span className="font-medium">Current User:</span> {currentUser?.email || 'Not authenticated'}</p>
              <p><span className="font-medium">Current User ID:</span> {currentUser?.uid || 'N/A'}</p>
              <p><span className="font-medium">Current User Display Name:</span> {currentUser?.displayName || 'N/A'}</p>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button
              variant="default"
              className="mr-3 bg-brand-purple hover:bg-brand-purple/90"
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                setError(null);
                // Force refresh the component by changing the key in URL
                navigate(`/${username}/${repoName}?refresh=${Date.now()}`);
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      <div className="container mx-auto px-4 pt-20 pb-10 relative z-10">
        <Button 
          variant="ghost" 
          className="mb-6 text-white hover:bg-white/10" 
          onClick={() => navigate('/home')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Repository Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-6 w-6 text-brand-purple" />
                  <h1 className="text-2xl font-bold text-gray-900">{repoName}</h1>
                  {repository.isPublic ? (
                    <Globe className="h-4 w-4 text-gray-500" aria-label="Public repository" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-500" aria-label="Private repository" />
                  )}
                </div>
                {repository.description && (
                  <p className="mt-1 text-gray-600">{repository.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>Created {formatDistanceToNow(new Date(repository.createdAt))} ago</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  className="bg-brand-purple hover:bg-brand-purple/90"
                  onClick={() => setShowUploadDialog(true)}
                  disabled={isUploading || isCreatingFile || !isUserRepo}
                  style={{ display: isUserRepo ? 'flex' : 'none' }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading || isCreatingFile ? `Uploading ${uploadProgress?.toFixed(0)}%` : "Upload File"}
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={downloadRepository}
                  disabled={isDownloading || files.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isDownloading ? 
                    (uploadProgress !== null ? `Creating zip ${uploadProgress}%` : "Creating zip...") : 
                    "Download Repo"}
                </Button>
                
                {/* Pull Request Button */}
                <div className="flex gap-2 items-center">
                  {!isLoading && repository && (
                    <>
                      <Button 
                        className="bg-brand-purple hover:bg-brand-purple/90 flex items-center"
                        onClick={() => repository?.forkedFrom ? 
                          navigate(`/${currentUser?.displayName || currentUser?.email?.split('@')[0] || ''}/${repository?.name}/pull-requests`) : 
                          setShowForkDialog(true)}
                      >
                        {repository?.forkedFrom ? (
                          <>
                            <GitPullRequest className="h-4 w-4 mr-2" />
                            Pull Requests
                          </>
                        ) : (
                          <>
                            <GitFork className="h-4 w-4 mr-2" />
                            Fork
                          </>
                        )}
                      </Button>
                      
                      {/* Only show the pending commits button to repository owners */}
                      {isUserRepo && (
                        <Button
                          variant="outline"
                          className="flex items-center"
                          onClick={() => navigate(`/${username}/${repoName}/pending-commits`)}
                        >
                          <ClipboardCheck className="h-4 w-4 mr-2" />
                          Pending Commits
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {/* Delete Repository Button - Only shown for owned repositories */}
                {isUserRepo && (
                  <Button 
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-50"
                    onClick={() => setShowDeleteRepoDialog(true)}
                    disabled={isDeletingRepo}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Repository
                  </Button>
                )}
              </div>
            </div>
            
            {(isUploading || isDownloading || isForking) && uploadProgress !== null && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-purple transition-all duration-300 ease-in-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {isDownloading ? "Creating zip file..." : isForking ? "Forking repository..." : "Uploading..."}
                </p>
              </div>
            )}
          </div>

          {/* File Upload Dialog */}
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-auto">
              <DialogHeader className="mb-2">
                <DialogTitle className="text-xl">Add File to Repository</DialogTitle>
                <DialogDescription>
                  Choose an option below to add files to your repository
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="create" className="w-full py-4">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="create" className="flex items-center gap-2">
                    <PlusIcon className="h-4 w-4" />
                    Create New File
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <FileUpIcon className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="space-y-6 p-1">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="filename">File Name</Label>
                      <Input 
                        id="filename" 
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="Enter file name (e.g., readme.txt)"
                      />
                      <p className="text-xs text-gray-500">
                        File extension will be added automatically if not provided (.txt by default)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="filecontent">File Content</Label>
                      <Textarea 
                        id="filecontent"
                        value={newFileContent}
                        onChange={(e) => setNewFileContent(e.target.value)}
                        placeholder="Enter file content here..."
                        className="min-h-[200px]"
                      />
                    </div>
                    
                    <Button 
                      onClick={createNewFile}
                      disabled={!newFileName || isCreatingFile}
                      className="w-full bg-brand-purple hover:bg-brand-purple/90"
                    >
                      {isCreatingFile ? 
                        <span className="flex items-center">
                          <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                          Creating...
                        </span> : 
                        "Create File"
                      }
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="upload" className="space-y-6 p-1">
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center">
                    <Input
                      type="file"
                      id="file-upload-dialog"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                    <Label 
                      htmlFor="file-upload-dialog"
                      className="cursor-pointer flex flex-col items-center justify-center gap-3"
                    >
                      <FileUpIcon className="h-12 w-12 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Click to select a file</p>
                        <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Supports any file type</p>
                    </Label>
                  </div>
                  
                  <Button 
                    onClick={() => document.getElementById('file-upload-dialog')?.click()}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={isUploading}
                  >
                    {isUploading ? 
                      <span className="flex items-center">
                        <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                        Uploading {uploadProgress?.toFixed(0)}%
                      </span> : 
                      "Select File"
                    }
                  </Button>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="sm:justify-start">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Fork Dialog */}
          <Dialog open={showForkDialog} onOpenChange={setShowForkDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Fork Repository</DialogTitle>
                <DialogDescription>
                  Create a copy of {repository?.name} in your account.
                </DialogDescription>
              </DialogHeader>
              
              <div className="p-4 border rounded-lg bg-gray-50 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  Forking creates a copy of this repository and all its files in your account. You can then make changes to your fork without affecting the original repository.
                </p>
              </div>
              
              <div className="grid gap-4 py-4">
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="fork-name">Repository Name</Label>
                  <Input 
                    id="fork-name" 
                    placeholder="Enter repository name"
                    value={forkName}
                    onChange={(e) => setForkName(e.target.value)}
                    disabled={isForking}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isForking}>Cancel</Button>
                </DialogClose>
                <Button 
                  onClick={executeFork} 
                  className="bg-brand-purple hover:bg-brand-purple/90"
                  disabled={!forkName.trim() || isForking}
                >
                  {isForking ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                      Forking...
                    </span>
                  ) : (
                    <>
                      <GitFork className="h-4 w-4 mr-2" />
                      Fork Repository
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* History Dialog */}
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <HistoryIcon className="h-5 w-5" />
                  Commit History for {selectedFile}
                </DialogTitle>
                <DialogDescription>
                  View all changes made to this file
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                {isLoadingHistory ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700"></div>
                  </div>
                ) : fileHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No history found for this file</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Author
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Message
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {fileHistory.map((commit, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(commit.timestamp).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="text-sm font-medium text-gray-900">
                                  {commit.userEmail || "Unknown"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {commit.commitMessage || "No message"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button 
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // View this version of the file
                                  toast({
                                    title: "Opening version",
                                    description: "This feature is coming soon",
                                  });
                                }}
                                className="text-brand-purple hover:text-brand-purple/80"
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowHistoryDialog(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this file?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The file "{fileToDelete?.name}" will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteFile();
                  }}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {isDeleting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                      Deleting...
                    </span>
                  ) : (
                    <>Delete</>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Repository Confirmation Dialog */}
          <AlertDialog open={showDeleteRepoDialog} onOpenChange={setShowDeleteRepoDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this repository?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The repository "{repository?.name}" and all its files will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingRepo}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteRepository();
                  }}
                  disabled={isDeletingRepo}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {isDeletingRepo ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                      Deleting...
                    </span>
                  ) : (
                    <>Delete Repository</>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Repository Files */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Files</h2>
            
            {files.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                <FileIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-700 mb-1">No files yet</h3>
                <p className="text-gray-500 mb-4">Upload your first file to this repository</p>
                <Button 
                  variant="outline"
                  className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Files
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {files.map((file) => (
                      <tr key={file.path} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <FileIcon className="h-5 w-5 text-gray-400 mr-3" />
                            <button 
                              onClick={() => {
                                toast({
                                  title: "Opening file editor",
                                  description: `Loading ${file.name}...`,
                                  duration: 5000, // Show for 5 seconds
                                });
                                // Consider adding a slight delay to ensure the toast is shown
                                setTimeout(() => {
                                  navigate(`/${username}/${repoName}/edit/${file.name}`);
                                }, 50);
                              }}
                              className="text-sm font-medium text-brand-purple hover:text-brand-purple/80 hover:underline text-left"
                            >
                              {file.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDistanceToNow(file.createdAt)} ago
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              toast({
                                title: "Opening file editor",
                                description: `Loading ${file.name}...`,
                                duration: 5000, // Show for 5 seconds
                              });
                              // Consider adding a slight delay to ensure the toast is shown
                              setTimeout(() => {
                                navigate(`/${username}/${repoName}/edit/${file.name}`);
                              }, 50);
                            }}
                            className="text-brand-purple hover:text-brand-purple/80 mr-2"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadFile(file.downloadUrl, file.name)}
                            className="text-brand-purple hover:text-brand-purple/80 mr-2"
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchFileHistory(file.name)}
                            className="text-gray-600 hover:text-gray-900 mr-2"
                          >
                            <HistoryIcon className="h-3.5 w-3.5 mr-1" />
                            History
                          </Button>
                          {isUserRepo && (
                            <Button 
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDeleteFile(file)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositoryDetails; 
