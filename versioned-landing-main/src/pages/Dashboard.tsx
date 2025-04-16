import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bell, 
  GitPullRequest, 
  Plus, 
  Search, 
  Settings, 
  LogOut, 
  Lock,
  FileIcon,
  Globe
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { logoutUser } from "@/lib/authService";
import { getUserRepositories, getAllPublicRepositories, searchRepositories, requestRepositoryAccess, Repository } from "@/lib/repositoryService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NotificationBell from "@/components/NotificationBell";
import { toast } from "@/components/ui/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [allPublicRepositories, setAllPublicRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredRepositories, setFilteredRepositories] = useState<Repository[]>([]);
  const [mainSearchQuery, setMainSearchQuery] = useState("");
  const [mainFilteredRepositories, setMainFilteredRepositories] = useState<Repository[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState<{[key: string]: boolean}>({});
  
  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Get initials for avatar fallback
  const getInitials = () => {
    if (!userProfile?.username) return "U";
    return userProfile.username.substring(0, 2).toUpperCase();
  };
  
  // Get display name (username or email)
  const displayName = userProfile?.username || currentUser?.email?.split('@')[0] || "User";

  // Get username for URL links
  const getUsername = () => {
    return currentUser?.displayName || 
           currentUser?.email?.split('@')[0] || 
           currentUser?.uid?.substring(0, 8);
  };

  // Load repositories
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load user repositories
        const userReposResult = await getUserRepositories();
        
        if (!userReposResult.success) {
          setError(userReposResult.error || "Failed to load repositories");
          setIsLoading(false);
          return;
        }
        
        setRepositories(userReposResult.repositories || []);
        
        // Load all public repositories
        try {
          const publicReposResult = await getAllPublicRepositories();
          
          if (publicReposResult.success) {
            setAllPublicRepositories(publicReposResult.repositories || []);
          } else {
            console.error("Failed to load public repositories:", publicReposResult.error);
            // Don't set a global error for this - just log it and continue
          }
        } catch (publicRepoErr) {
          console.error("Error fetching public repositories:", publicRepoErr);
          // We can still function with just user repositories, so continue
        }
        
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter repositories based on sidebar search query (only user repos)
  useEffect(() => {
    if (!searchQuery) {
      setFilteredRepositories(repositories);
    } else {
      const filtered = repositories.filter(repo => 
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredRepositories(filtered);
    }
  }, [searchQuery, repositories]);

  // Handle main search query for global repository search
  useEffect(() => {
    const performSearch = async () => {
      if (!mainSearchQuery) {
        setMainFilteredRepositories([]);
        setIsSearching(false);
        setError(null); // Clear any previous errors
        return;
      }
      
      setIsSearching(true);
      setError(null); // Clear any previous errors
      
      try {
        // Use the new searchRepositories function with advanced options
        const searchResult = await searchRepositories(mainSearchQuery, {
          includeUserRepos: true,
          includePublicRepos: true,
          includePrivateCollaborations: true,
          includeAllPrivateRepos: true,
          limitResults: 20,
          sortOption: 'relevance'
        });
        
        if (searchResult.success) {
          setMainFilteredRepositories(searchResult.repositories || []);
          
          // Set a non-critical error/warning if we have one
          if (searchResult.error) {
            setError(searchResult.error);
          }
        } else {
          console.error("Search failed:", searchResult.error);
          setMainFilteredRepositories([]);
          if (searchResult.error) {
            setError(searchResult.error);
          }
        }
      } catch (err: any) {
        console.error("Error during search:", err);
        setMainFilteredRepositories([]);
        setError(err.message || "An error occurred during search");
      } finally {
        setIsSearching(false);
      }
    };
    
    // Set a small delay to avoid excessive API calls while typing
    const delaySearch = setTimeout(() => {
      performSearch();
    }, 300);
    
    return () => clearTimeout(delaySearch);
  }, [mainSearchQuery]);

  // Function to get repository owner display name
  const getRepoOwnerName = (ownerId: string) => {
    if (ownerId === currentUser?.uid) {
      return "You";
    }
    return `User ${ownerId.substring(0, 6)}`;
  };

  // Function to check if user has access to a repository
  const hasAccessToRepo = (repo: Repository): boolean => {
    if (!currentUser) return false;
    
    // User is the owner
    if (repo.ownerId === currentUser.uid) return true;
    
    // User is a collaborator
    if (repo.collaborators?.includes(currentUser.uid)) return true;
    
    // Repository is public
    if (repo.isPublic) return true;
    
    return false;
  };
  
  // Function to handle requesting access to a repository
  const handleRequestAccess = async (repoId: string, repoName: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to request access.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setRequestingAccess(prev => ({ ...prev, [repoId]: true }));
      
      const result = await requestRepositoryAccess(repoId);
      
      if (result.success) {
        toast({
          title: "Access Requested",
          description: `Your request to access ${repoName} has been sent to the owner.`,
        });
      } else {
        toast({
          title: "Request Failed",
          description: result.error || "Failed to request access. Please try again.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Error requesting access:", err);
      toast({
        title: "Request Failed",
        description: err.message || "An error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRequestingAccess(prev => ({ ...prev, [repoId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      {/* Navigation Bar */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/10 fixed w-full z-10">
        <div className="w-full px-0">
          <div className="flex justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-white">
                FileVersion
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10"
                onClick={() => navigate("/create")}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <NotificationBell />
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10"
                onClick={() => navigate(`/${currentUser?.displayName || currentUser?.email?.split('@')[0] || ''}/repositories/pull-requests`)}
              >
                <GitPullRequest className="h-5 w-5" />
              </Button>
              
              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
                    <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarImage src={currentUser?.photoURL || ""} />
                      <AvatarFallback className="bg-purple-700 text-white">{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500 focus:text-red-500">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-16 flex flex-col lg:flex-row relative">
        {/* Sidebar */}
        <div className="w-full lg:w-64 bg-white/10 backdrop-blur-md border-b lg:border-r border-white/10 lg:min-h-screen lg:fixed">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-300" />
              <Input
                type="text"
                placeholder="Search repositories..."
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {searchQuery ? "Search Results" : "Top Repositories"}
              </h3>
              <ul className="mt-4 space-y-2">
                {filteredRepositories.length > 0 ? (
                  filteredRepositories
                    .slice(0, searchQuery ? 10 : 5)
                    .map((repo) => (
                      <li key={repo.id}>
                        <Link
                          to={`/${repo.ownerId === currentUser?.uid ? getUsername() : repo.ownerId.substring(0, 8)}/${repo.name}`}
                          className="flex items-center text-sm text-gray-300 hover:text-white"
                        >
                          <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                          {repo.name}
                          {!repo.isPublic && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Lock className="h-3 w-3 ml-1.5 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{repo.ownerId === currentUser?.uid ? "Your private repository" : "Private repository (Collaborator)"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </Link>
                      </li>
                    ))
                ) : (
                  <li className="text-sm text-gray-500">
                    {searchQuery ? "No matching repositories found" : "No repositories yet"}
                  </li>
                )}
              </ul>
              {searchQuery && filteredRepositories.length > 0 && (
                <div className="mt-4 text-center">
                  <Button 
                    variant="ghost" 
                    className="text-xs text-gray-400 hover:text-white"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 lg:ml-64 p-6">
          <div className="max-w-3xl mx-auto">
            {/* Existing content */}
            <div className="mb-6 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">Discover Repositories</h1>
              <Button onClick={() => navigate("/create")} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                New Repository
              </Button>
            </div>
          
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-300" />
              <Input
                type="text"
                placeholder="Search repositories..."
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                value={mainSearchQuery}
                onChange={(e) => setMainSearchQuery(e.target.value)}
              />
            </div>
            
            {mainSearchQuery && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                  Search Results
                  {!isSearching && (
                    <span className="text-gray-300 text-sm ml-2">
                      ({mainFilteredRepositories.length} found)
                    </span>
                  )}
                  {isSearching && (
                    <div className="ml-2 flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-purple-500 rounded-full border-t-transparent"></div>
                      <span className="text-gray-300 text-sm ml-2">Searching...</span>
                    </div>
                  )}
                </h2>
                
                {error && (
                  <div className="p-3 mb-4 bg-amber-600/20 border border-amber-600/40 rounded-md">
                    <p className="text-amber-200 text-sm">{error}</p>
                  </div>
                )}
                
                {isSearching && mainFilteredRepositories.length === 0 && (
                  <div className="flex justify-center items-center py-12 text-gray-400">
                    <div className="animate-pulse">Searching repositories...</div>
                  </div>
                )}
                
                {!isSearching && mainFilteredRepositories.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 mb-8">
                    {mainFilteredRepositories.map((repo) => (
                      <div key={repo.id} className="relative">
                        {!hasAccessToRepo(repo) && (
                          <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center rounded-lg z-10">
                            <Button
                              onClick={(e) => handleRequestAccess(repo.id!, repo.name, e)}
                              disabled={requestingAccess[repo.id!]}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              {requestingAccess[repo.id!] ? (
                                <span className="flex items-center">
                                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></div>
                                  Requesting...
                                </span>
                              ) : (
                                <>Request Access</>
                              )}
                            </Button>
                          </div>
                        )}
                        <Link 
                          key={repo.id}
                          to={hasAccessToRepo(repo) ? `/${repo.ownerId === currentUser?.uid ? getUsername() : repo.ownerId.substring(0, 8)}/${repo.name}` : "#"}
                          onClick={(e) => !hasAccessToRepo(repo) && e.preventDefault()}
                          className={`block p-4 bg-white/10 hover:bg-white/15 rounded-lg transition-colors ${!hasAccessToRepo(repo) ? 'cursor-default' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileIcon className="h-5 w-5 text-purple-400 mr-3" />
                              <div>
                                <div className="flex items-center">
                                  <h3 className="text-white font-medium">{repo.name}</h3>
                                  {repo.isPublic ? (
                                    <Globe className="h-3.5 w-3.5 ml-2 text-gray-400" aria-label="Public repository" />
                                  ) : (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Lock className="h-3.5 w-3.5 ml-2 text-gray-400" aria-label="Private repository" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>
                                            {repo.ownerId === currentUser?.uid 
                                              ? "Your private repository" 
                                              : repo.collaborators?.includes(currentUser?.uid || '')
                                                ? "Private repository (Collaborator)"
                                                : "Private repository"}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <div className="flex flex-col mt-1 sm:flex-row sm:items-center">
                                  <p className="text-xs text-gray-400">
                                    {repo.ownerId === currentUser?.uid 
                                      ? "Created by you" 
                                      : repo.collaborators?.includes(currentUser?.uid || '')
                                        ? `Created by ${getRepoOwnerName(repo.ownerId)} (You are a collaborator)`
                                        : `Created by ${getRepoOwnerName(repo.ownerId)}`}
                                  </p>
                                  {repo.description && (
                                    <p className="text-gray-400 text-sm sm:ml-4 mt-1 sm:mt-0">{repo.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              Updated {new Date(repo.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                
                {!isSearching && mainFilteredRepositories.length === 0 && (
                  <div className="text-center py-12 text-gray-400 bg-white/5 rounded-lg">
                    <div className="mb-2">No repositories matching "{mainSearchQuery}"</div>
                    <div className="text-sm">Try a different search term or check your spelling</div>
                  </div>
                )}
                
                {!isSearching && mainFilteredRepositories.length > 0 && (
                  <div className="text-center mb-4">
                    <Button 
                      variant="ghost" 
                      className="text-xs text-gray-400 hover:text-white"
                      onClick={() => setMainSearchQuery("")}
                    >
                      Clear Search
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!mainSearchQuery && (
              <>
                {/* <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2> */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 mt-6">
                  <Link to="/create">
                    <Button 
                      className="h-24 w-full flex flex-col items-center justify-center space-y-2 bg-white/10 hover:bg-white/20 text-white border-white/10"
                    >
                      <Plus className="h-6 w-6" />
                      <span>Create New Repository</span>
                    </Button>
                  </Link>
                  <Button className="h-24 flex flex-col items-center justify-center space-y-2 bg-white/10 hover:bg-white/20 text-white border-white/10">
                    <GitPullRequest className="h-6 w-6" />
                    <span>View Pull Requests</span>
                  </Button>
                  <Button className="h-24 flex flex-col items-center justify-center space-y-2 bg-white/10 hover:bg-white/20 text-white border-white/10">
                    <Bell className="h-6 w-6" />
                    <span>Notifications</span>
                  </Button>
                  <Button 
                    className="h-24 flex flex-col items-center justify-center space-y-2 bg-white/10 hover:bg-white/20 text-white border-white/10"
                    onClick={() => navigate('/profile/settings')}
                  >
                    <Settings className="h-6 w-6" />
                    <span>Profile Settings</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 