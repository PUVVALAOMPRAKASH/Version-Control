import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, FileText, Clock, AlertTriangle, Download, GitFork, File, Image as ImageIcon, FileType } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserRepositories, getRepositoryByOwnerAndName } from "@/lib/repositoryService";
import { 
  downloadFileFromS3, 
  getFileSignedUrl,
  commitFileVersion,
  createPendingCommit,
  isTextFile as checkIsTextFile
} from "@/lib/s3Service";

// Helper function for consistent and detailed logging
const logMessage = (type: 'info' | 'error' | 'warning', component: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}][${component}][${type.toUpperCase()}]`;
  
  if (type === 'error') {
    if (data) {
      console.error(`${prefix} ${message}`, data);
    } else {
      console.error(`${prefix} ${message}`);
    }
  } else if (type === 'warning') {
    if (data) {
      console.warn(`${prefix} ${message}`, data);
    } else {
      console.warn(`${prefix} ${message}`);
    }
  } else {
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
};

const FileEditor = () => {
  const params = useParams<{ username: string; repoName: string; fileName: string }>();
  const { username, repoName, fileName } = params;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [fileContent, setFileContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [lastCommitTime, setLastCommitTime] = useState<Date | null>(null);
  const [isTextFile, setIsTextFile] = useState(true);
  const [fileURL, setFileURL] = useState<string | null>(null);
  const [isUserOwned, setIsUserOwned] = useState(false);
  const [fileType, setFileType] = useState<'text' | 'image' | 'pdf' | 'binary'>('text');
  const [binaryData, setBinaryData] = useState<Uint8Array | null>(null);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [isCommitRequesting, setIsCommitRequesting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const loadRepository = async () => {
      if (!username || !repoName || !fileName || !currentUser) {
        setError("Missing required information from the URL");
        setIsLoading(false);
        return;
      }

      try {
        // Set a timeout for the entire operation
        timeoutId = setTimeout(() => {
          if (isMounted) {
            setError("Loading timed out. The file might be too large or there may be connectivity issues.");
            setIsLoading(false);
          }
        }, 20000); // 20 seconds timeout
        
        // Check if this is the current user's repository
        const isCurrentUser = currentUser.displayName === username || 
                             currentUser.email?.split('@')[0] === username ||
                             currentUser.uid.substring(0, 8) === username;
        
        let repoId: string | null = null;
        
        if (isCurrentUser) {
          // Get the user's own repositories
          const result = await getUserRepositories();

          if (!isMounted) return;

          if (!result.success || !result.repositories) {
            clearTimeout(timeoutId);
            setError(result.error || "Failed to load repositories");
            setIsLoading(false);
            return;
          }

          // Find the repository by name
          const repo = result.repositories.find(r => r.name.toLowerCase() === repoName.toLowerCase());
          
          if (!isMounted) return;
          
          if (!repo || !repo.id) {
            clearTimeout(timeoutId);
            setError(`Repository '${repoName}' not found`);
            setIsLoading(false);
            return;
          }

          repoId = repo.id;
          setIsUserOwned(true);
          setIsCollaborator(false);
        } else {
          // Get repository by owner username and repo name
          const result = await getRepositoryByOwnerAndName(username, repoName);
          
          if (!isMounted) return;
          
          if (!result.success || !result.repository) {
            clearTimeout(timeoutId);
            setError(result.error || "Repository not found or you don't have access to it");
            setIsLoading(false);
            return;
          }
          
          repoId = result.repository.id;
          // Check if user is a collaborator
          setIsUserOwned(result.repository.ownerId === currentUser.uid);
          setIsCollaborator(
            result.repository.collaborators?.includes(currentUser.uid) || false
          );
        }

        setRepositoryId(repoId);
        
        // Load file from S3
        await loadFileFromS3(repoId);
        
        if (isMounted) {
          clearTimeout(timeoutId);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          clearTimeout(timeoutId);
          setError(err.message || "An unexpected error occurred");
          setIsLoading(false);
        }
      }
    };

    loadRepository();
    
    // Cleanup function to handle component unmounting
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [username, repoName, fileName, currentUser]);
  
  // Load file content from S3
  const loadFileFromS3 = async (repoId: string) => {
    if (!fileName) throw new Error("File name is missing");
    
    try {
      logMessage('info', 'FileEditor', `Loading file from S3: ${repoId}/${fileName}`);
      
      // Check if it's a text file
      const isFileText = checkIsTextFile(fileName);
      setIsTextFile(isFileText);
      
      // Determine file type for preview
      const lowerFileName = fileName.toLowerCase();
      if (isFileText) {
        setFileType('text');
      } else if (
        lowerFileName.endsWith('.jpg') || 
        lowerFileName.endsWith('.jpeg') || 
        lowerFileName.endsWith('.png') || 
        lowerFileName.endsWith('.gif') || 
        lowerFileName.endsWith('.svg') || 
        lowerFileName.endsWith('.webp')
      ) {
        setFileType('image');
      } else if (lowerFileName.endsWith('.pdf')) {
        setFileType('pdf');
      } else {
        setFileType('binary');
      }
      
      try {
        // Get a signed URL for downloading
        const urlResult = await getFileSignedUrl(repoId, fileName);
        if (urlResult.success && urlResult.url) {
          setFileURL(urlResult.url);
        } else {
          logMessage('warning', 'FileEditor', 'Failed to get signed URL', urlResult.error);
        }
      } catch (urlError) {
        logMessage('warning', 'FileEditor', 'Error getting signed URL', urlError);
        // Continue anyway, we can still try to download the file content
      }
      
      // Download the file content
      const result = await downloadFileFromS3(repoId, fileName);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to download file");
      }
      
      // Set last modified time
      if (result.metadata && result.metadata['uploaded-at']) {
        setLastCommitTime(new Date(result.metadata['uploaded-at']));
      }
      
      // Handle content based on file type
      if (isFileText) {
        // For text files
        if (typeof result.content === 'string') {
          setFileContent(result.content);
          setOriginalContent(result.content);
        } else {
          // If we got ArrayBuffer for a text file, convert it
          const textDecoder = new TextDecoder('utf-8');
          const content = textDecoder.decode(result.content as ArrayBuffer);
          setFileContent(content);
          setOriginalContent(content);
        }
      } else {
        // For binary files
        setFileContent("This is a binary file and cannot be edited in the text editor.");
        setOriginalContent("This is a binary file and cannot be edited in the text editor.");
        
        // Store binary data for hex view
        if (result.content instanceof ArrayBuffer) {
          setBinaryData(new Uint8Array(result.content));
        } else if (typeof result.content === 'string') {
          // Convert string to binary data
          const encoder = new TextEncoder();
          setBinaryData(encoder.encode(result.content));
        }
      }
    } catch (error: any) {
      logMessage('error', 'FileEditor', 'Error loading file from S3', error);
      throw new Error(`Failed to load file: ${error.message}`);
    }
  };

  // Function to download the current file
  const downloadFile = () => {
    if (!fileURL || !fileName) return;
    
    try {
      // Create a temporary anchor element
      const anchor = document.createElement('a');
      anchor.href = fileURL;
      anchor.download = fileName;
      anchor.target = '_blank';
      
      // Add to DOM, click, and remove
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      
      toast({
        title: "Download started",
        description: `Downloading ${fileName}`,
      });
    } catch (err) {
      logMessage('error', 'FileEditor', 'Error downloading file', err);
      toast({
        title: "Download failed",
        description: "Could not download the file",
        variant: "destructive",
      });
    }
  };

  // Function to render binary data as hex
  const renderHexView = () => {
    if (!binaryData) return null;
    
    // Limit the size for performance
    const maxDisplayBytes = 1024; // Show max 1KB of data
    const displayData = binaryData.length > maxDisplayBytes 
      ? binaryData.slice(0, maxDisplayBytes) 
      : binaryData;
    
    const rows = [];
    
    // Process 16 bytes per row
    for (let i = 0; i < displayData.length; i += 16) {
      const chunk = displayData.slice(i, i + 16);
      
      // Create hex values
      const hexValues = Array.from(chunk).map(byte => 
        byte.toString(16).padStart(2, '0')
      );
      
      // Create ASCII representation
      const asciiValues = Array.from(chunk).map(byte => {
        // Show printable ASCII characters, replace others with a dot
        return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
      });
      
      rows.push(
        <div key={i} className="flex font-mono text-xs">
          <div className="w-20 text-gray-500">{i.toString(16).padStart(8, '0')}</div>
          <div className="flex-1">
            {hexValues.map((hex, idx) => (
              <span key={idx} className="inline-block w-6">{hex}</span>
            ))}
          </div>
          <div className="w-32 text-gray-700">
            {asciiValues.join('')}
          </div>
        </div>
      );
    }
    
    return (
      <div className="border border-gray-200 rounded-md p-4 bg-gray-50 overflow-auto max-h-[60vh]">
        <div className="flex font-mono text-xs font-semibold mb-2">
          <div className="w-20 text-gray-500">Offset</div>
          <div className="flex-1">Hexadecimal Values</div>
          <div className="w-32 text-gray-700">ASCII</div>
        </div>
        <div className="border-t border-gray-200 pt-2">
          {rows}
        </div>
        {binaryData.length > maxDisplayBytes && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-gray-500 text-xs">
            Showing {maxDisplayBytes} bytes of {binaryData.length} total bytes. 
            <Button 
              variant="link" 
              size="sm" 
              className="text-xs p-0 h-auto text-brand-purple"
              onClick={downloadFile}
            >
              Download the complete file
            </Button>
          </div>
        )}
      </div>
    );
  };

  const handleCommit = async () => {
    if (!repositoryId || !fileName || !currentUser) {
      toast({
        title: "Error",
        description: "Missing repository information",
        variant: "destructive",
      });
      return;
    }

    if (!commitMessage.trim()) {
      toast({
        title: "Error",
        description: "Please provide a commit message",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCommitting(true);
      
      // Get previous version timestamp for history tracking
      const previousVersionTimestamp = lastCommitTime ? lastCommitTime.toISOString() : undefined;
      
      // Commit the file using S3 service
      const commitResult = await commitFileVersion(
        repositoryId,
        fileName,
        fileContent,
        commitMessage,
        previousVersionTimestamp
      );
      
      if (!commitResult.success) {
        throw new Error(commitResult.error || "Failed to commit changes");
      }
      
      // Update state with new information
      setOriginalContent(fileContent);
      setCommitMessage("");
      setLastCommitTime(new Date());
      
      toast({
        title: "Changes committed",
        description: `Successfully committed changes to ${fileName}`,
      });
      
      // Reload the file content to ensure UI is up-to-date
      logMessage('info', 'FileEditor', 'Reloading file after commit');
      try {
        await loadFileFromS3(repositoryId);
        logMessage('info', 'FileEditor', 'File reloaded successfully after commit');
      } catch (reloadError) {
        logMessage('warning', 'FileEditor', 'Failed to reload file after commit, using local version', reloadError);
        // If reload fails, we'll continue with the local version
      }
      
      setIsCommitting(false);
    } catch (err: any) {
      logMessage('error', 'FileEditor', 'Error committing changes', err);
      setIsCommitting(false);
      toast({
        title: "Commit failed",
        description: err.message || "Failed to commit changes",
        variant: "destructive",
      });
    }
  };

  // Add a new function to handle collaborator commit requests
  const handleCollaboratorCommit = async () => {
    if (!repositoryId || !fileName || !currentUser) {
      toast({
        title: "Error",
        description: "Missing repository information",
        variant: "destructive",
      });
      return;
    }

    if (!commitMessage.trim()) {
      toast({
        title: "Error",
        description: "Please provide a commit message",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCommitRequesting(true);
      
      // Create a pending commit request
      const result = await createPendingCommit(
        repositoryId,
        fileName,
        fileContent,
        commitMessage
      );
      
      if (!result.success) {
        throw new Error(result.error || "Failed to submit changes for approval");
      }
      
      // Update state
      setCommitMessage("");
      
      toast({
        title: "Changes submitted",
        description: `Your changes to ${fileName} have been submitted for approval`,
      });
      
      setIsCommitRequesting(false);
    } catch (err: any) {
      logMessage('error', 'FileEditor', 'Error submitting changes for approval', err);
      setIsCommitRequesting(false);
      toast({
        title: "Submission failed",
        description: err.message || "Failed to submit changes",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="text-white text-lg">Loading file content...</p>
        <p className="text-white/70 text-sm mt-2">This might take a moment for larger files</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden p-6">
          <div className="flex items-start text-red-600">
            <div className="w-full">
              <h2 className="text-xl font-bold">Error Loading File</h2>
              <p className="mt-2">{error}</p>
              
              <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200 text-gray-700 text-sm">
                <h3 className="font-medium mb-2">Debug Information:</h3>
                <div className="grid grid-cols-1 gap-2">
                  <p><span className="font-semibold">User:</span> {username}</p>
                  <p><span className="font-semibold">Repository:</span> {repoName}</p>
                  <p><span className="font-semibold">File:</span> {fileName}</p>
                  <p><span className="font-semibold">Repository ID:</span> {repositoryId || 'Not found'}</p>
                  <p><span className="font-semibold">Path:</span> repositories/{repositoryId}/files/{fileName}</p>
                  <p><span className="font-semibold">Current User:</span> {currentUser?.email || 'Not authenticated'}</p>
                  <p><span className="font-semibold">Current User ID:</span> {currentUser?.uid || 'N/A'}</p>
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <Button 
                  className="bg-brand-purple hover:bg-brand-purple/90" 
                  onClick={() => navigate(`/${username}/${repoName}`)}
                >
                  Back to Repository
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (repositoryId) {
                      setIsLoading(true);
                      setError(null);
                      loadFileFromS3(repositoryId).catch(err => {
                        setError(err.message || "Failed to load file");
                        setIsLoading(false);
                      });
                    } else {
                      // No repository ID, go back to repository page and try again
                      navigate(`/${username}/${repoName}?refresh=${Date.now()}`);
                    }
                  }}
                >
                  Retry Loading
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Back to Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasChanges = fileContent !== originalContent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      <div className="container mx-auto px-4 pt-20 pb-10 relative z-10">
        <Button 
          variant="ghost" 
          className="mb-6 text-white hover:bg-white/10" 
          onClick={() => navigate(`/${username}/${repoName}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Repository
        </Button>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* File Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {fileType === 'text' && <FileText className="h-6 w-6 text-brand-purple" />}
                {fileType === 'image' && <ImageIcon className="h-6 w-6 text-brand-purple" />}
                {fileType === 'pdf' && <FileType className="h-6 w-6 text-brand-purple" />}
                {fileType === 'binary' && <File className="h-6 w-6 text-brand-purple" />}
                <h1 className="text-2xl font-bold text-gray-900">{fileName}</h1>
              </div>
              
              <div className="flex items-center gap-4">
                {fileURL && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadFile}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                )}
                
                {!isUserOwned && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/${username}/${repoName}`)}
                    className="flex items-center gap-1"
                  >
                    <GitFork className="h-4 w-4" />
                    Fork Repository
                  </Button>
                )}
                
                {lastCommitTime && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Last modified: {lastCommitTime.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* File Content Editor or Viewer */}
          <div className="p-6">
            {!isTextFile && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-700">Binary File Detected</p>
                  <p className="text-sm text-yellow-600">
                    This {fileType === 'image' || fileType === 'pdf' ? `is a ${fileType} file that can be viewed below but` : 'is shown in hex format below but'} can't be edited in the text editor. 
                    You can download it using the button above and re-upload a new version if needed.
                  </p>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              {/* Content based on file type */}
              {fileType === 'text' && (
                <Textarea 
                  value={fileContent} 
                  onChange={(e) => setFileContent(e.target.value)}
                  className="font-mono text-sm h-[60vh] resize-none border border-gray-300 rounded p-4"
                  spellCheck={false}
                  disabled={!isUserOwned || !isTextFile}
                  readOnly={!isUserOwned}
                />
              )}
              
              {/* Image Preview */}
              {fileType === 'image' && fileURL && (
                <div className="flex justify-center p-4 border border-gray-200 rounded bg-gray-50 min-h-[60vh] items-center">
                  <img 
                    src={fileURL} 
                    alt={fileName || "Image preview"} 
                    className="max-w-full max-h-[58vh] object-contain"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMjJDMTcuNSAyMiAyMiAxNy41IDIyIDEyQzIyIDYuNSAxNy41IDIgMTIgMkM2LjUgMiAyIDYuNSAyIDEyQzIgMTcuNSA2LjUgMjIgMTIgMjJaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTEyIDggTCAxMiAxMiIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xMiAxNkgxMi4wMSIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==';
                      e.currentTarget.style.padding = '2rem';
                      logMessage('error', 'FileEditor', 'Failed to load image', { fileName, fileURL });
                    }}
                  />
                </div>
              )}
              
              {/* PDF Preview */}
              {fileType === 'pdf' && fileURL && (
                <div className="border border-gray-200 rounded min-h-[60vh]">
                  <iframe 
                    src={`${fileURL}#toolbar=0`} 
                    title={fileName || "PDF preview"}
                    className="w-full h-[60vh]"
                    sandbox="allow-scripts allow-same-origin"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const errorMsg = document.createElement('div');
                      errorMsg.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-[60vh] bg-gray-50 p-6 text-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.48-8.48l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                          </svg>
                          <h3 class="text-lg font-medium text-gray-700 mt-4">PDF preview unavailable</h3>
                          <p class="text-sm text-gray-500 mt-2">Please download the file to view it.</p>
                        </div>
                      `;
                      target.parentNode.appendChild(errorMsg);
                      logMessage('error', 'FileEditor', 'Failed to load PDF', { fileName, fileURL });
                    }}
                  />
                </div>
              )}
              
              {/* Binary File Hex Viewer */}
              {fileType === 'binary' && binaryData && (
                <div className="border-gray-200 rounded-lg">
                  <div className="mb-2 flex justify-between items-center">
                    <div className="font-medium text-gray-700 flex items-center">
                      <File className="h-4 w-4 mr-2 text-brand-purple" />
                      Binary File Viewer
                    </div>
                    <div className="text-sm text-gray-500">
                      {binaryData.length.toLocaleString()} bytes
                    </div>
                  </div>
                  {renderHexView()}
                </div>
              )}
              
              {!isUserOwned && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
                  <p>This file is read-only because you are not the owner of this repository.</p>
                  <p className="mt-1">To make changes, fork this repository to your account.</p>
                </div>
              )}
            </div>

            {/* Commit Section */}
            <div className={`border rounded-lg p-4 bg-gray-50 ${(hasChanges && isTextFile && (isUserOwned || isCollaborator)) ? '' : 'opacity-50'}`}>
              <h3 className="text-lg font-semibold mb-3">
                {isUserOwned ? "Commit Changes" : "Submit Changes for Approval"}
              </h3>
              <div className="mb-4">
                <Label htmlFor="commit-message">Commit Message</Label>
                <Input
                  id="commit-message"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={isUserOwned ? "Describe the changes you made" : "Describe your changes for the repository owner"}
                  disabled={!hasChanges || (isCommitting || isCommitRequesting) || !isTextFile || (!isUserOwned && !isCollaborator)}
                  className="mt-1"
                />
              </div>
              {isUserOwned ? (
                <Button
                  onClick={handleCommit}
                  disabled={!hasChanges || !commitMessage || isCommitting || !isTextFile}
                  className="bg-brand-purple hover:bg-brand-purple/90"
                >
                  {isCommitting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                      Committing...
                    </span>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Commit Changes
                    </>
                  )}
                </Button>
              ) : isCollaborator ? (
                <Button
                  onClick={handleCollaboratorCommit}
                  disabled={!hasChanges || !commitMessage || isCommitRequesting || !isTextFile}
                  className="bg-brand-purple hover:bg-brand-purple/90"
                >
                  {isCommitRequesting ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></span>
                      Submitting...
                    </span>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </>
                  )}
                </Button>
              ) : null}
              
              {!isTextFile && (
                <p className="mt-3 text-sm text-gray-500">
                  Binary files cannot be edited in the browser. Please download the file, 
                  make your changes, and upload a new version from the repository page.
                </p>
              )}
              
              {!isUserOwned && !isCollaborator && (
                <p className="mt-3 text-sm text-gray-500">
                  You need to fork this repository or be a collaborator to make changes.
                </p>
              )}
              
              {isCollaborator && (
                <p className="mt-3 text-sm text-gray-500">
                  As a collaborator, your changes will be sent to the repository owner for approval.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileEditor; 