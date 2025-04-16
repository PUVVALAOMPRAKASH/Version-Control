import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  GitPullRequest, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  GitFork,
  Search
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  createPullRequest,
  getChangedFiles
} from "@/lib/pullRequestService";
import { 
  getRepositoryByOwnerAndName, 
  getRepository,
  searchRepositories
} from "@/lib/repositoryService";
import { useAuth } from "@/lib/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const CreatePullRequest = () => {
  const { username, repoName } = useParams<{ username: string; repoName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [sourceRepository, setSourceRepository] = useState<any>(null);
  const [targetRepository, setTargetRepository] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  
  // PR form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  const loadSourceRepository = async () => {
    if (!username || !repoName) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Load source repository details
      const repoResult = await getRepositoryByOwnerAndName(username, repoName);
      
      if (!repoResult.success || !repoResult.repository) {
        throw new Error(repoResult.error || "Repository not found");
      }
      
      setSourceRepository(repoResult.repository);
      
      // Check if this is a fork
      if (!repoResult.repository.forkedFrom) {
        throw new Error("This repository is not a fork. You can only create pull requests from forks.");
      }
      
      // If it's a fork, try to load the parent repository
      if (repoResult.repository.forkedFrom) {
        const parentResult = await getRepository(repoResult.repository.forkedFrom);
        
        if (parentResult.success && parentResult.repository) {
          setTargetRepository(parentResult.repository);
          
          // Auto-generate title based on repo names
          setTitle(`Updates from ${repoResult.repository.name}`);
        }
      }
      
    } catch (err: any) {
      console.error("Error loading repository:", err);
      setError(err.message || "Failed to load repository data");
    } finally {
      setIsLoading(false);
    }
  };
  
  const searchForRepositories = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      
      const result = await searchRepositories(searchQuery);
      
      if (result.success) {
        // Filter out current repository
        const filteredResults = result.repositories.filter(repo => 
          repo.id !== sourceRepository?.id
        );
        
        setSearchResults(filteredResults);
      } else {
        toast({
          title: "Search failed",
          description: result.error || "Failed to search repositories",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error searching repositories:", err);
      toast({
        title: "Search error",
        description: err.message || "An error occurred while searching",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  const selectTargetRepository = (repo: any) => {
    setTargetRepository(repo);
    setShowSearchDialog(false);
    
    // Auto-generate title based on repo names
    if (sourceRepository) {
      setTitle(`Updates from ${sourceRepository.name} to ${repo.name}`);
    }
  };
  
  const loadChangedFiles = async () => {
    if (!sourceRepository?.id || !targetRepository?.id) return;
    
    try {
      setIsLoadingFiles(true);
      
      const result = await getChangedFiles(sourceRepository.id, targetRepository.id);
      
      if (result.success) {
        setChangedFiles(result.files || []);
      } else {
        toast({
          title: "Could not load changed files",
          description: result.error || "Failed to determine changed files",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error loading changed files:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load changed files",
        variant: "destructive"
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sourceRepository?.id || !targetRepository?.id) {
      toast({
        title: "Missing information",
        description: "Both source and target repositories are required",
        variant: "destructive"
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please provide a title for your pull request",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await createPullRequest(
        title,
        description,
        sourceRepository.id,
        sourceRepository.name,
        targetRepository.id,
        targetRepository.name,
        targetRepository.ownerId,
        changedFiles
      );
      
      if (!result.success) {
        throw new Error(result.error || "Failed to create pull request");
      }
      
      toast({
        title: "Pull request created",
        description: "Your pull request has been submitted successfully",
      });
      
      // Navigate to the pull request details
      if (result.pullRequest?.id) {
        setTimeout(() => {
          navigate(`/pull-request/${result.pullRequest!.id}`);
        }, 1000);
      } else {
        // Navigate back to repository
        setTimeout(() => {
          navigate(`/${username}/${repoName}`);
        }, 1000);
      }
      
    } catch (err: any) {
      console.error("Error creating pull request:", err);
      toast({
        title: "Failed to create pull request",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    loadSourceRepository();
  }, [username, repoName]);
  
  useEffect(() => {
    if (sourceRepository?.id && targetRepository?.id) {
      loadChangedFiles();
    }
  }, [sourceRepository?.id, targetRepository?.id]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading repository data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <div className="text-center text-red-600 mb-4">
            <AlertCircle className="h-10 w-10 mx-auto mb-2" />
            <p>{error}</p>
          </div>
          <Button onClick={() => navigate(`/${username}/${repoName}`)} className="w-full">
            Back to Repository
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 text-black">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(`/${username}/${repoName}`)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center">
                <GitPullRequest className="h-6 w-6 text-brand-purple mr-2" />
                <h1 className="text-2xl font-bold">Create Pull Request</h1>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Source Repository</h3>
                <div className="flex items-center">
                  <GitFork className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="font-medium text-gray-900">{sourceRepository?.name}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{sourceRepository?.description || "No description"}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Target Repository</h3>
                {targetRepository ? (
                  <div className="flex items-center">
                    <GitFork className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium text-gray-900">{targetRepository.name}</span>
                  </div>
                ) : (
                  <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Search className="h-4 w-4 mr-2" />
                        Select Target Repository
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Select Target Repository</DialogTitle>
                        <DialogDescription>
                          Search for a repository to send your pull request to.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="flex items-center space-x-2 mb-4">
                        <Input 
                          placeholder="Search repositories..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && searchForRepositories()}
                        />
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={searchForRepositories}
                          disabled={isSearching || !searchQuery.trim()}
                        >
                          {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      <ScrollArea className="h-[300px] rounded-md border p-2">
                        {searchResults.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            {!isSearching ? (
                              <p className="text-center">No repositories found. Try a different search term.</p>
                            ) : (
                              <Loader2 className="h-6 w-6 animate-spin mb-2" />
                            )}
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {searchResults.map((repo) => (
                              <li 
                                key={repo.id}
                                className="p-3 rounded-md hover:bg-gray-100 cursor-pointer"
                                onClick={() => selectTargetRepository(repo)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium">{repo.name}</h4>
                                    <p className="text-sm text-gray-500 line-clamp-2">
                                      {repo.description || "No description"}
                                    </p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="ml-2"
                                  >
                                    Select
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </ScrollArea>
                      
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {targetRepository && (
                  <p className="text-sm text-gray-500 mt-1">{targetRepository.description || "No description"}</p>
                )}
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What's this pull request about?"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details about the changes you're proposing..."
                    rows={5}
                  />
                </div>
                
                <div>
                  <Label className="mb-2 block">Changes</Label>
                  {isLoadingFiles ? (
                    <div className="flex items-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Loading changed files...</span>
                    </div>
                  ) : changedFiles.length > 0 ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <h4 className="text-sm font-medium mb-2">Changed Files ({changedFiles.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {changedFiles.map((file) => (
                          <Badge key={file} variant="outline" className="bg-white">
                            {file}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 py-2">
                      {targetRepository ? 
                        "No changed files detected between repositories." : 
                        "Select a target repository to see changed files."}
                    </div>
                  )}
                </div>
                
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-brand-purple hover:bg-brand-purple/90"
                    disabled={isSubmitting || !targetRepository || isLoadingFiles}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating Pull Request...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <GitPullRequest className="h-4 w-4 mr-2" />
                        Create Pull Request
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePullRequest; 