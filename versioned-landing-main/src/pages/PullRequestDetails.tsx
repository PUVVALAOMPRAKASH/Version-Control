import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  GitPullRequest,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  GitCommit,
  GitMerge,
  GitFork,
  User
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { 
  getPullRequest, 
  updatePullRequestStatus,
  mergePullRequest
} from "@/lib/pullRequestService";
import { getFileContent } from "@/lib/s3Service";
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";

const PullRequestDetails = () => {
  const { pullRequestId } = useParams<{ pullRequestId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [pullRequest, setPullRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isUpdating, setIsUpdating] = useState(false);
  const [comment, setComment] = useState("");
  
  // Dialog states
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  
  // File content states
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<{[key: string]: {source: string, target: string | null}}>({}); 
  const [fileLoading, setFileLoading] = useState<{[key: string]: boolean}>({});
  
  const isOwner = currentUser && pullRequest && currentUser.uid === pullRequest.targetOwnerId;
  const isCreator = currentUser && pullRequest && currentUser.uid === pullRequest.createdBy.id;
  const isPrOpen = pullRequest && pullRequest.status === 'open';
  
  const loadData = async () => {
    if (!pullRequestId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Load pull request details
      const result = await getPullRequest(pullRequestId);
      
      if (!result.success || !result.pullRequest) {
        throw new Error(result.error || "Pull request not found");
      }
      
      setPullRequest(result.pullRequest);
      
    } catch (err: any) {
      console.error("Error loading pull request:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, [pullRequestId]);
  
  const loadFileContent = async (fileName: string) => {
    if (!pullRequest) return;
    
    // Set loading state for this file
    setFileLoading(prev => ({...prev, [fileName]: true}));
    
    try {
      // Load source file content
      const sourceResult = await getFileContent(pullRequest.sourceRepoId, fileName);
      
      // Try to load target file content (might not exist)
      const targetResult = await getFileContent(pullRequest.targetRepoId, fileName).catch(() => ({
        success: false,
        content: null
      }));
      
      // Update file contents state
      setFileContents(prev => ({
        ...prev,
        [fileName]: {
          source: sourceResult.success ? sourceResult.content : "Failed to load content",
          target: targetResult.success ? targetResult.content : null
        }
      }));
      
    } catch (err) {
      console.error(`Error loading content for ${fileName}:`, err);
      toast({
        title: "Error loading file",
        description: `Could not load content for ${fileName}`,
        variant: "destructive"
      });
    } finally {
      // Clear loading state
      setFileLoading(prev => ({...prev, [fileName]: false}));
    }
  };
  
  const handleFileSelect = (fileName: string) => {
    setSelectedFile(fileName);
    
    // Load file content if we haven't already
    if (!fileContents[fileName]) {
      loadFileContent(fileName);
    }
  };
  
  const handleUpdateStatus = async (status: 'merged' | 'rejected' | 'closed') => {
    if (!pullRequest || !pullRequestId) return;
    
    setIsUpdating(true);
    
    try {
      let result;
      
      if (status === 'merged') {
        // Merge process handles copying files
        result = await mergePullRequest(pullRequestId, comment);
      } else {
        // Just update status for reject/close
        result = await updatePullRequestStatus(pullRequestId, status, comment);
      }
      
      if (!result.success) {
        throw new Error(result.error || `Failed to ${status} pull request`);
      }
      
      // Update local state
      setPullRequest({
        ...pullRequest,
        status,
        updatedAt: new Date().toISOString()
      });
      
      // Show success message
      toast({
        title: `Pull request ${status}`,
        description: status === 'merged' 
          ? "The changes have been merged into the target repository" 
          : `The pull request has been ${status}`,
        duration: 5000
      });
      
      // Close any open dialogs
      setShowMergeDialog(false);
      setShowRejectDialog(false);
      setShowCloseDialog(false);
      
      // Reset comment
      setComment("");
      
    } catch (err: any) {
      console.error(`Error ${status} pull request:`, err);
      toast({
        title: `Could not ${status} pull request`,
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500">Open</Badge>;
      case 'merged':
        return <Badge className="bg-purple-600">Merged</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'closed':
        return <Badge className="bg-gray-500">Closed</Badge>;
      default:
        return null;
    }
  };
  
  // Add a function to handle back navigation safely
  const handleBackNavigation = () => {
    // Check if we have a stored return path (from notifications)
    const returnPath = sessionStorage.getItem('returnPath');
    if (returnPath) {
      // Clear the stored path
      sessionStorage.removeItem('returnPath');
      // Navigate to the stored path
      navigate(returnPath);
    }
    // If no stored path, try history or fallback to home
    else if (window.history.length > 1) {
      navigate(-1); // Go back to the previous page
    } else {
      // If there's no previous page, navigate to home as a fallback
      navigate('/home');
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading pull request...</p>
        </div>
      </div>
    );
  }
  
  if (error || !pullRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <div className="text-center text-red-600 mb-4">
            <AlertCircle className="h-10 w-10 mx-auto mb-2" />
            <p>{error || "Pull request not found"}</p>
          </div>
          <Button onClick={handleBackNavigation} className="w-full">
            Go Back
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 text-black">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleBackNavigation}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center">
                <GitPullRequest className="h-6 w-6 text-brand-purple mr-2" />
                <h1 className="text-xl font-bold">{pullRequest.title}</h1>
              </div>
              <div className="ml-2">
                {getStatusBadge(pullRequest.status)}
              </div>
            </div>
            
            <div className="flex flex-wrap justify-between items-start mb-6">
              <div className="space-y-2 mb-4 md:mb-0">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-1" />
                  <span>Created by {pullRequest.createdBy.name}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <GitCommit className="h-4 w-4 mr-1" />
                  <span>Created {formatDistanceToNow(new Date(pullRequest.createdAt), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <GitFork className="h-4 w-4 mr-1" />
                  <span>From <span className="font-medium">{pullRequest.sourceRepoName}</span> to <span className="font-medium">{pullRequest.targetRepoName}</span></span>
                </div>
              </div>
              
              {isPrOpen && (
                <div className="flex flex-wrap gap-2">
                  {isOwner && (
                    <>
                      <Button
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => setShowMergeDialog(true)}
                        disabled={isUpdating}
                      >
                        <GitMerge className="h-4 w-4 mr-1" />
                        Merge
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setShowRejectDialog(true)}
                        disabled={isUpdating}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  
                  {isCreator && (
                    <Button
                      variant="outline"
                      onClick={() => setShowCloseDialog(true)}
                      disabled={isUpdating}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Close PR
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="files">Changed Files</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="pt-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  <p className="text-gray-700 whitespace-pre-line">{pullRequest.description || "No description provided."}</p>
                </div>
              </TabsContent>
              
              <TabsContent value="files" className="pt-6">
                {pullRequest.changedFiles && pullRequest.changedFiles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg overflow-hidden md:col-span-1">
                      <div className="bg-gray-50 p-3 border-b">
                        <h3 className="font-medium">Changed Files ({pullRequest.changedFiles.length})</h3>
                      </div>
                      <div className="overflow-auto max-h-[400px]">
                        <ul className="divide-y">
                          {pullRequest.changedFiles.map((file: string) => (
                            <li
                              key={file}
                              className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center ${selectedFile === file ? 'bg-brand-purple/10' : ''}`}
                              onClick={() => handleFileSelect(file)}
                            >
                              <FileText className="h-4 w-4 text-gray-500 mr-2" />
                              <span className="text-sm truncate">{file}</span>
                              {fileLoading[file] && (
                                <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden md:col-span-2">
                      {selectedFile ? (
                        fileLoading[selectedFile] ? (
                          <div className="flex items-center justify-center h-[400px]">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-purple" />
                          </div>
                        ) : (
                          <div>
                            <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                              <h3 className="font-medium">{selectedFile}</h3>
                            </div>
                            <div className="grid grid-cols-1 divide-y">
                              <div className="p-3">
                                <h4 className="text-sm font-medium mb-2 text-gray-500">Source Content</h4>
                                <pre className="bg-gray-50 p-3 rounded overflow-auto text-sm max-h-[200px]">
                                  {fileContents[selectedFile]?.source || "No content available"}
                                </pre>
                              </div>
                              <div className="p-3">
                                <h4 className="text-sm font-medium mb-2 text-gray-500">
                                  {fileContents[selectedFile]?.target === null ? 
                                    "File doesn't exist in target repository" : 
                                    "Target Content"}
                                </h4>
                                {fileContents[selectedFile]?.target !== null ? (
                                  <pre className="bg-gray-50 p-3 rounded overflow-auto text-sm max-h-[200px]">
                                    {fileContents[selectedFile]?.target || "No content available"}
                                  </pre>
                                ) : (
                                  <div className="bg-yellow-50 text-yellow-800 p-3 rounded text-sm">
                                    This is a new file that will be added to the target repository.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-center h-[400px] text-gray-500">
                          <div className="text-center">
                            <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                            <p>Select a file to view its content</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">No changed files</h3>
                    <p className="text-gray-500">This pull request doesn't have any changed files</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Pull Request</DialogTitle>
            <DialogDescription>
              This will merge the changes into the target repository.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {pullRequest.changedFiles && pullRequest.changedFiles.length > 0 ? (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Files that will be merged ({pullRequest.changedFiles.length}):</h4>
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-2 text-sm">
                  <ul className="space-y-1">
                    {pullRequest.changedFiles.map((file: string) => (
                      <li key={file} className="flex items-center">
                        <FileText className="h-3 w-3 text-gray-500 mr-2" />
                        <span className="truncate">{file}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="mb-4 bg-yellow-50 border-yellow-200 border rounded p-3 text-yellow-800 text-sm">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium">No files to merge</p>
                    <p className="mt-1">This pull request doesn't have any changed files. Merging will only update the status.</p>
                  </div>
                </div>
              </div>
            )}
            
            <Label htmlFor="merge-comment" className="mb-2 block">Add a comment (optional)</Label>
            <Textarea
              id="merge-comment"
              placeholder="Comment on this merge..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isUpdating}
            />
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isUpdating}>Cancel</Button>
            </DialogClose>
            <Button 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => handleUpdateStatus('merged')}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <span className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Merging...
                </span>
              ) : (
                <span className="flex items-center">
                  <GitMerge className="h-4 w-4 mr-1" />
                  Confirm Merge
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Pull Request</DialogTitle>
            <DialogDescription>
              The author will be notified that you rejected this pull request.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="reject-comment" className="mb-2 block">Reason for rejection (optional)</Label>
            <Textarea
              id="reject-comment"
              placeholder="Explain why you're rejecting this pull request..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isUpdating}
            />
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isUpdating}>Cancel</Button>
            </DialogClose>
            <Button 
              variant="destructive"
              onClick={() => handleUpdateStatus('rejected')}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <span className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Rejecting...
                </span>
              ) : (
                <span className="flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject Pull Request
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Close Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Pull Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to close this pull request? This can't be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="close-comment" className="mb-2 block">Comment (optional)</Label>
            <Textarea
              id="close-comment"
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isUpdating}
            />
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isUpdating}>Cancel</Button>
            </DialogClose>
            <Button 
              variant="default"
              onClick={() => handleUpdateStatus('closed')}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <span className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Closing...
                </span>
              ) : (
                <span className="flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  Close Pull Request
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PullRequestDetails; 