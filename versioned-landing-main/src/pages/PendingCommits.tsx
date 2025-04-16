import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { 
  ArrowLeft, 
  Check, 
  X, 
  FileIcon, 
  User,
  Clock,
  MessageSquare,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { 
  getPendingCommitRequests, 
  processPendingCommit,
  getFileContent,
  getFileVersion
} from "@/lib/s3Service";
import { getUserRepositories, getRepositoryByOwnerAndName } from "@/lib/repositoryService";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const PendingCommits = () => {
  const params = useParams<{ username: string, repoName: string }>();
  const { username, repoName } = params;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [pendingCommits, setPendingCommits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // Dialog states
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<any | null>(null);
  const [diffView, setDiffView] = useState<{
    original: string;
    modified: string;
  } | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadRepository();
  }, [username, repoName, currentUser]);
  
  const loadRepository = async () => {
    if (!username || !repoName || !currentUser) {
      setError("Missing required information");
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if this is the current user's repository
      const isCurrentUser = currentUser.displayName === username || 
                           currentUser.email?.split('@')[0] === username ||
                           currentUser.uid.substring(0, 8) === username;
      
      let repoId: string | null = null;
      
      if (isCurrentUser) {
        // Get the user's own repositories
        const result = await getUserRepositories();
        
        if (!result.success || !result.repositories) {
          setError(result.error || "Failed to load repositories");
          setIsLoading(false);
          return;
        }
        
        // Find the repository by name
        const repo = result.repositories.find(r => r.name.toLowerCase() === repoName.toLowerCase());
        
        if (!repo || !repo.id) {
          setError(`Repository '${repoName}' not found`);
          setIsLoading(false);
          return;
        }
        
        repoId = repo.id;
        setIsOwner(repo.ownerId === currentUser.uid);
      } else {
        // Get repository by owner username and repo name
        const result = await getRepositoryByOwnerAndName(username, repoName);
        
        if (!result.success || !result.repository) {
          setError(result.error || "Repository not found or you don't have access to it");
          setIsLoading(false);
          return;
        }
        
        repoId = result.repository.id;
        setIsOwner(result.repository.ownerId === currentUser.uid);
      }
      
      setRepositoryId(repoId);
      
      // Only owners can see pending commits
      if (!isOwner) {
        setError("Only repository owners can view pending commit requests");
        setIsLoading(false);
        return;
      }
      
      // Load pending commits
      await loadPendingCommits(repoId);
      
      setIsLoading(false);
    } catch (err: any) {
      console.error("Error loading repository:", err);
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const loadPendingCommits = async (repoId: string) => {
    try {
      const result = await getPendingCommitRequests(repoId);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load pending commit requests");
      }
      
      // Filter to only show 'pending' status
      const pendingOnly = (result.requests || []).filter(req => req.status === 'pending');
      setPendingCommits(pendingOnly);
    } catch (err: any) {
      console.error("Error loading pending commits:", err);
      throw err;
    }
  };

  const handleViewDetails = async (commit: any) => {
    setSelectedCommit(commit);
    setIsLoadingDiff(true);
    setShowDetailsDialog(true);
    
    try {
      if (!repositoryId) return;
      
      // Get the current version of the file
      const currentVersionResult = await getFileContent(repositoryId, commit.fileName);
      
      // Get the pending version
      const modifiedVersionResult = await getFileVersion(
        repositoryId,
        commit.fileName,
        commit.timestamp,
        true, // From pending folder
      );
      
      if (!currentVersionResult.success || !modifiedVersionResult.success) {
        throw new Error("Failed to load file versions for comparison");
      }
      
      setDiffView({
        original: currentVersionResult.content || "",
        modified: modifiedVersionResult.content || "",
      });
    } catch (err: any) {
      console.error("Error loading diff:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load file difference",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const handleProcessCommit = async (approve: boolean) => {
    if (!repositoryId || !selectedCommit) return;
    
    try {
      setIsProcessing(true);
      
      const result = await processPendingCommit(
        repositoryId,
        selectedCommit.id,
        selectedCommit.fileName,
        approve,
        approvalComment
      );
      
      if (!result.success) {
        throw new Error(result.error || `Failed to ${approve ? 'approve' : 'reject'} commit`);
      }
      
      toast({
        title: approve ? "Commit Approved" : "Commit Rejected",
        description: approve 
          ? "The changes have been applied to the repository" 
          : "The changes have been rejected",
      });
      
      // Update the local state
      setPendingCommits(pendingCommits.filter(c => c.id !== selectedCommit.id));
      
      // Close the dialog
      setShowDetailsDialog(false);
      setSelectedCommit(null);
      setDiffView(null);
      setApprovalComment("");
    } catch (err: any) {
      console.error(`Error ${approve ? 'approving' : 'rejecting'} commit:`, err);
      toast({
        title: "Error",
        description: err.message || `Failed to ${approve ? 'approve' : 'reject'} commit`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderDiff = () => {
    if (!diffView) return null;
    
    // Very simple diff view - just show side by side
    return (
      <div className="grid grid-cols-2 gap-4 h-96">
        <div className="border rounded p-4 overflow-auto">
          <h3 className="text-sm font-medium mb-2">Current Version</h3>
          <pre className="text-xs whitespace-pre-wrap font-mono">{diffView.original}</pre>
        </div>
        <div className="border rounded p-4 overflow-auto">
          <h3 className="text-sm font-medium mb-2">Proposed Changes</h3>
          <pre className="text-xs whitespace-pre-wrap font-mono">{diffView.modified}</pre>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
        <p className="text-white text-lg">Loading pending commits...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden p-6">
          <div className="flex items-start text-red-600">
            <AlertCircle className="h-6 w-6 mr-3 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-red-600">Error</h2>
              <p className="mt-2 text-gray-700">{error}</p>
              
              <div className="mt-6 flex gap-3">
                <Button 
                  className="bg-brand-purple hover:bg-brand-purple/90" 
                  onClick={() => navigate(`/${username}/${repoName}`)}
                >
                  Back to Repository
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      <div className="container mx-auto px-4 pt-20 pb-10 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-white/10" 
            onClick={() => navigate(`/${username}/${repoName}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Repository
          </Button>
          
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => loadRepository()}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Pending Commit Requests</h1>
            <p className="text-gray-500 mt-1">
              Review and manage pending changes from collaborators
            </p>
          </div>

          <div className="p-6">
            {pendingCommits.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium mb-1">No Pending Commits</h3>
                <p>There are no pending commit requests to review at this time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingCommits.map((commit) => (
                  <div 
                    key={commit.id} 
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetails(commit)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        <FileIcon className="h-5 w-5 text-brand-purple mt-1 mr-3" />
                        <div>
                          <h3 className="font-medium">{commit.fileName}</h3>
                          <p className="text-sm text-gray-600 mt-1">{commit.message}</p>
                          <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {commit.author}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Pending
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commit Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review Commit Request</DialogTitle>
            <DialogDescription>
              {selectedCommit && `Reviewing changes to ${selectedCommit.fileName}`}
            </DialogDescription>
          </DialogHeader>

          {selectedCommit && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">File</h3>
                    <p className="mt-1">{selectedCommit.fileName}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Author</h3>
                    <p className="mt-1">{selectedCommit.author}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Submitted</h3>
                    <p className="mt-1">{new Date(selectedCommit.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Status</h3>
                    <Badge variant="outline" className="mt-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                      Pending
                    </Badge>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Commit Message</h3>
                  <p className="mt-1 p-2 bg-gray-50 rounded-md">{selectedCommit.message}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">File Changes</h3>
                  
                  {isLoadingDiff ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
                    </div>
                  ) : (
                    <Tabs defaultValue="diff">
                      <TabsList>
                        <TabsTrigger value="diff">Changes</TabsTrigger>
                      </TabsList>
                      <TabsContent value="diff">
                        <ScrollArea className="h-full max-h-[400px] rounded-md border">
                          {renderDiff()}
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">
                    <MessageSquare className="h-4 w-4 inline mr-1" />
                    Add Comment (Optional)
                  </h3>
                  <Textarea
                    placeholder="Add a comment to explain your decision..."
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    className="w-full"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive"
                    onClick={() => handleProcessCommit(false)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Reject Changes
                      </>
                    )}
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleProcessCommit(true)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve Changes
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingCommits; 