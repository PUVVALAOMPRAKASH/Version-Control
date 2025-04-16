import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  GitPullRequest, 
  Loader2, 
  Check, 
  X,
  AlertCircle,
  Filter,
  RefreshCw,
  Plus
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getPullRequests } from "@/lib/pullRequestService";
import { getRepositoryByOwnerAndName } from "@/lib/repositoryService";
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const PullRequests = () => {
  const { username, repoName } = useParams<{ username: string; repoName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [repository, setRepository] = useState<any>(null);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [tabValue, setTabValue] = useState<string>("incoming");
  
  const loadData = async () => {
    if (!username || !repoName) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Load repository details
      const repoResult = await getRepositoryByOwnerAndName(username, repoName);
      
      if (!repoResult.success || !repoResult.repository) {
        throw new Error(repoResult.error || "Repository not found");
      }
      
      setRepository(repoResult.repository);
      
      // Load pull requests
      const isTarget = tabValue === "incoming";
      const prResult = await getPullRequests(repoResult.repository.id, isTarget);
      
      if (!prResult.success) {
        if (prResult.error && prResult.error.includes('permission')) {
          throw new Error("Insufficient permissions: Please make sure your Firebase security rules allow access to the pullRequests collection. Check the documentation for the required security rules setup.");
        } else {
          throw new Error(prResult.error || "Failed to load pull requests");
        }
      }
      
      setPullRequests(prResult.pullRequests || []);
      
    } catch (err: any) {
      console.error("Error loading pull requests:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, [username, repoName, tabValue]);
  
  const handleRefresh = () => {
    loadData();
  };
  
  const filteredPullRequests = pullRequests.filter(pr => {
    if (filterStatus === "all") return true;
    return pr.status === filterStatus;
  });
  
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
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading pull requests...</p>
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
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(`/${username}/${repoName}`)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center">
                <GitPullRequest className="h-6 w-6 text-brand-purple mr-2" />
                <h1 className="text-2xl font-bold">Pull Requests</h1>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                
                {tabValue === "outgoing" && (
                  <Button
                    size="sm"
                    className="bg-brand-purple hover:bg-brand-purple/90"
                    onClick={() => navigate(`/${username}/${repoName}/create-pr`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Pull Request
                  </Button>
                )}
              </div>
            </div>
            
            <Tabs value={tabValue} onValueChange={setTabValue} className="w-full">
              <div className="flex justify-between items-center">
                <TabsList>
                  <TabsTrigger value="incoming">Incoming</TabsTrigger>
                  <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
                </TabsList>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-1" />
                      {filterStatus === "all" ? "All" : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={filterStatus} onValueChange={setFilterStatus}>
                      <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="open">Open</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="merged">Merged</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="rejected">Rejected</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="closed">Closed</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <TabsContent value="incoming" className="mt-6">
                {filteredPullRequests.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                    <GitPullRequest className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">No incoming pull requests</h3>
                    <p className="text-gray-500">There are no pull requests targeting this repository</p>
                  </div>
                ) : (
                  <div className="overflow-hidden border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Author
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPullRequests.map((pr) => (
                          <tr 
                            key={pr.id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/pull-request/${pr.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <GitPullRequest className="h-4 w-4 text-brand-purple mr-2" />
                                <div className="text-sm font-medium text-gray-900">
                                  {pr.title}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {pr.createdBy.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(pr.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="outgoing" className="mt-6">
                {filteredPullRequests.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                    <GitPullRequest className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">No outgoing pull requests</h3>
                    <p className="text-gray-500 mb-4">This repository hasn't sent any pull requests</p>
                    <Button
                      className="bg-brand-purple hover:bg-brand-purple/90"
                      onClick={() => navigate(`/${username}/${repoName}/create-pr`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Pull Request
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-hidden border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Target Repository
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPullRequests.map((pr) => (
                          <tr 
                            key={pr.id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/pull-request/${pr.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <GitPullRequest className="h-4 w-4 text-brand-purple mr-2" />
                                <div className="text-sm font-medium text-gray-900">
                                  {pr.title}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {pr.targetRepoName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(pr.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PullRequests; 