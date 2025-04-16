import { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  FileText,
  History as HistoryIcon,
  AlertCircle,
  Clock,
  FileIcon,
  Undo2
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { getUserRepositories, getRepositoryByOwnerAndName } from "@/lib/repositoryService";
import { listFileCommits, getFileVersion, restoreFileVersion } from "@/lib/s3Service";

const FileHistory = () => {
  const params = useParams<{ username: string; repoName: string; fileName: string }>();
  const { username, repoName, fileName } = params;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [fileHistory, setFileHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isViewingCommit, setIsViewingCommit] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const loadRepository = async () => {
      if (!username || !repoName || !fileName) {
        setError("Missing required information");
        setIsLoading(false);
        return;
      }

      try {
        // Check if this is the current user's repository
        const isCurrentUser = currentUser && (
          currentUser.displayName === username || 
          currentUser.email?.split('@')[0] === username || 
          currentUser.uid.substring(0, 8) === username
        );
        
        let repoId: string | null = null;
        
        if (isCurrentUser) {
          // Get the user's repositories
          const result = await getUserRepositories();
          
          if (!result.success || !result.repositories) {
            throw new Error(result.error || "Failed to load repositories");
          }
          
          // Find the repository by name
          const repo = result.repositories.find(r => r.name.toLowerCase() === repoName.toLowerCase());
          
          if (!repo) {
            throw new Error(`Repository '${repoName}' not found`);
          }
          
          repoId = repo.id;
        } else {
          // Get repository by owner and name
          const result = await getRepositoryByOwnerAndName(username, repoName);
          
          if (!result.success || !result.repository) {
            throw new Error(result.error || "Repository not found");
          }
          
          repoId = result.repository.id;
        }
        
        setRepositoryId(repoId);
        
        // Load file history
        await loadFileHistory(repoId);
      } catch (err: any) {
        console.error("Error loading repository:", err);
        setError(err.message || "An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    loadRepository();
  }, [username, repoName, fileName, currentUser]);

  const loadFileHistory = async (repoId: string) => {
    try {
      const result = await listFileCommits(repoId, fileName!);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load file history");
      }
      
      setFileHistory(result.commits || []);
    } catch (err: any) {
      console.error("Error loading file history:", err);
      setError(err.message || "Failed to load file history");
    }
  };

  const viewCommitVersion = async (commit: any) => {
    if (!repositoryId) return;
    
    setIsViewingCommit(true);
    setSelectedCommit(commit);
    
    try {
      const result = await getFileVersion(repositoryId, fileName!, commit.timestamp);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load version");
      }
      
      setFileContent(result.content || "");
    } catch (err: any) {
      console.error("Error viewing commit:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to view this version",
        variant: "destructive"
      });
    } finally {
      setIsViewingCommit(false);
    }
  };

  const restoreVersion = async (commit: any) => {
    if (!repositoryId || !fileName) return;
    
    setIsRestoring(true);
    
    try {
      const result = await restoreFileVersion(
        repositoryId,
        fileName,
        commit.timestamp,
        `Restored version from ${new Date(commit.timestamp).toLocaleString()}`
      );
      
      if (!result.success) {
        throw new Error(result.error || "Failed to restore version");
      }
      
      toast({
        title: "Version Restored",
        description: "The file has been reverted to this version",
        variant: "default"
      });
      
      // Navigate back to the repository view after a short delay
      setTimeout(() => {
        navigate(`/${username}/${repoName}`);
      }, 1500);
    } catch (err: any) {
      console.error("Error restoring version:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to restore this version",
        variant: "destructive"
      });
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-red-500 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Error Loading History</h1>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
          
          <div className="flex justify-center">
            <Button
              variant="default"
              className="mr-3 bg-brand-purple hover:bg-brand-purple/90 text-black"
              onClick={() => navigate(`/${username}/${repoName}`)}
            >
              Back to Repository
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 text-black">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      <div className="container mx-auto px-4 pt-20 pb-10 relative z-10">
        <Button 
          variant="ghost" 
          className="mb-6 text-black hover:bg-white/10" 
          onClick={() => navigate(`/${username}/${repoName}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Repository
        </Button>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* History Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileIcon className="h-6 w-6 text-brand-purple" />
                  <h1 className="text-2xl font-bold text-gray-900">{fileName}</h1>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <HistoryIcon className="h-4 w-4" />
                  <span>File History</span>
                </div>
              </div>
            </div>
          </div>

          {/* File History */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <HistoryIcon className="h-5 w-5 mr-2" />
              Commit History
            </h2>
            
            {fileHistory.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                <HistoryIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-700 mb-1">No history found</h3>
                <p className="text-gray-500 mb-4">This file has no recorded changes</p>
                <Button 
                  variant="outline"
                  className="border-brand-purple text-brand-purple hover:bg-brand-purple/10 text-black"
                  onClick={() => navigate(`/${username}/${repoName}`)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Repository
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Timeline View */}
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
                        <tr key={index} className={`hover:bg-gray-50 ${selectedCommit?.timestamp === commit.timestamp ? 'bg-purple-50' : ''}`}>
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
                              className="text-brand-purple hover:bg-brand-purple/10 mr-2"
                              onClick={() => viewCommitVersion(commit)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
                              onClick={() => restoreVersion(commit)}
                              disabled={isRestoring}
                            >
                              <Undo2 className="h-4 w-4 mr-1" />
                              {isRestoring ? "Restoring..." : "Restore"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Selected Version Content */}
                {selectedCommit && fileContent !== null && (
                  <div className="border rounded-lg overflow-hidden mt-6">
                    <div className="bg-gray-50 p-4 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">
                            Version from {new Date(selectedCommit.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCommit(null)}
                          className="text-gray-500"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4">
                      <pre className="text-sm text-black overflow-auto max-h-96 p-4 bg-white border rounded-md">
                        {fileContent}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileHistory;
