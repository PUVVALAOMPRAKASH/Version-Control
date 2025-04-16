import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createRepository } from "../lib/repositoryService";
import { useToast } from "@/components/ui/use-toast";
import { auth } from "@/lib/firebase";

const CreateRepository = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = () => {
      const user = auth.currentUser;
      if (!user) {
        // Redirect to login page
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Basic validation
    if (!name.trim()) {
      setError("Repository name is required");
      setIsLoading(false);
      return;
    }

    // Remove special characters and spaces
    const sanitizedName = name.trim().replace(/[^a-zA-Z0-9-_]/g, "-");

    try {
      console.log("Creating repository with name:", sanitizedName);
      console.log("Description:", description);
      console.log("Public:", isPublic);
      console.log("Current user:", auth.currentUser?.email);
      
      if (!auth.currentUser) {
        setError("You must be logged in to create a repository");
        setIsLoading(false);
        return;
      }
      
      // Attempt to create the repository
      const result = await createRepository(sanitizedName, description, isPublic);
      console.log("Repository creation result:", result);

      if (!result.success) {
        setError(result.error || "Failed to create repository");
        setIsLoading(false);
        return;
      }

      // Show success toast
      toast({
        title: "Repository created",
        description: `${sanitizedName} has been created successfully.`,
        duration: 5000,
      });

      // Log the ID to console for debugging
      console.log("Repository created with ID:", result.repository?.id);
      
      // Get username from email or user ID
      const username = auth.currentUser.displayName || 
                      auth.currentUser.email?.split('@')[0] || 
                      auth.currentUser.uid.substring(0, 8);
      
      // Ensure we have a valid repository
      if (result.repository) {
        // Create a direct URL to the repository page with username/repoName format
        const repositoryUrl = `/${encodeURIComponent(username)}/${sanitizedName}`;
        console.log("Navigating to repository page:", repositoryUrl);
        
        // For debugging - check what the current location is
        console.log("Current location before navigation:", window.location.href);
        
        // Show a message to the user
        setIsLoading(false);
        toast({
          title: "Redirecting...",
          description: "Taking you to your new repository page.",
        });
        
        // Give time for state to update before navigation
        setTimeout(() => {
          try {
            // Try direct navigation approach
            navigate(repositoryUrl);
            console.log("Navigation completed");
          } catch (navError) {
            console.error("Navigation error:", navError);
            // Fallback - try window.location approach if react-router fails
            window.location.href = repositoryUrl;
          }
        }, 1000); // Slightly longer timeout to ensure toast is visible
      } else {
        console.log("No repository returned, navigating to home");
        setIsLoading(false);
        toast({
          title: "Repository created",
          description: "Repository created but details were not returned. Returning to dashboard.",
          variant: "default",
        });
        
        setTimeout(() => {
          navigate('/home');
        }, 1000);
      }
    } catch (err: any) {
      console.error("Error creating repository:", err);
      
      // More detailed error message
      let errorMessage = "An unexpected error occurred";
      
      if (err.code === "permission-denied") {
        errorMessage = "Permission denied. You don't have permission to create repositories.";
      } else if (err.code === "unavailable") {
        errorMessage = "Firebase service is unavailable. Please try again later.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

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

        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create a new repository</h1>
            <p className="text-gray-600 mb-6">
              Create a repository to store and track versions of your files.
            </p>

            {error && (
              <Alert variant="destructive" className="mb-6 bg-red-50 text-red-800 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">
                  Repository name *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-awesome-project"
                  disabled={isLoading}
                  className="border-gray-200 focus:border-brand-purple focus:ring-brand-purple"
                />
                <p className="text-xs text-gray-500">
                  Use only letters, numbers, hyphens and underscores.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700">
                  Description (optional)
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your repository..."
                  disabled={isLoading}
                  className="resize-none h-24 border-gray-200 focus:border-brand-purple focus:ring-brand-purple"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="public"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isLoading}
                  className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                />
                <Label htmlFor="public" className="text-gray-700 cursor-pointer">
                  Make this repository public
                </Label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/home')}
                  disabled={isLoading}
                  className="border-gray-200 text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-brand-purple hover:bg-brand-purple/90 text-white"
                >
                  {isLoading ? "Creating..." : "Create repository"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRepository; 