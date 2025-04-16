import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import ProfileSettings from "./pages/ProfileSettings";
import AuthCallback from "./pages/AuthCallback";
import CreateRepository from "./pages/CreateRepository";
import RepositoryDetails from "./pages/RepositoryDetails";
import FileEditor from "./pages/FileEditor";
import FileHistory from "./pages/FileHistory";
import PullRequests from "./pages/PullRequests";
import PullRequestDetails from "./pages/PullRequestDetails";
import CreatePullRequest from "./pages/CreatePullRequest";
import Notifications from "./pages/Notifications";
import PendingCommits from "./pages/PendingCommits";
import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RedirectIfAuthenticated from "./components/RedirectIfAuthenticated";
import S3ConfigCheck from "./components/S3ConfigCheck";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          {/* Global S3 Config Error Message */}
          <div className="fixed top-4 left-4 right-4 z-50">
            <S3ConfigCheck />
          </div>
          
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={
              <RedirectIfAuthenticated redirectTo="/home">
                <Login />
              </RedirectIfAuthenticated>
            } />
            <Route path="/signup" element={
              <RedirectIfAuthenticated redirectTo="/home">
                <SignUp />
              </RedirectIfAuthenticated>
            } />
            
            {/* Protected routes */}
            <Route path="/home" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile/settings" element={
              <ProtectedRoute>
                <ProfileSettings />
              </ProtectedRoute>
            } />
            
            {/* Repository routes */}
            <Route path="/create" element={
              <ProtectedRoute>
                <CreateRepository />
              </ProtectedRoute>
            } />
            <Route path="/:username/:repoName" element={
              <ProtectedRoute>
                <RepositoryDetails />
              </ProtectedRoute>
            } />
            <Route path="/:username/:repoName/edit/:fileName" element={
              <ProtectedRoute>
                <FileEditor />
              </ProtectedRoute>
            } />
            <Route path="/:username/:repoName/history/:fileName" element={
              <ProtectedRoute>
                <FileHistory />
              </ProtectedRoute>
            } />
            
            {/* Pull Request Routes */}
            <Route path="/:username/:repoName/pull-requests" element={
              <ProtectedRoute>
                <PullRequests />
              </ProtectedRoute>
            } />
            
            <Route path="/:username/:repoName/create-pr" element={
              <ProtectedRoute>
                <CreatePullRequest />
              </ProtectedRoute>
            } />
            
            <Route path="/pull-request/:pullRequestId" element={
              <ProtectedRoute>
                <PullRequestDetails />
              </ProtectedRoute>
            } />
            
            {/* Pending Commits Route */}
            <Route path="/:username/:repoName/pending-commits" element={
              <ProtectedRoute>
                <PendingCommits />
              </ProtectedRoute>
            } />
            
            {/* Notifications Route */}
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />
            
            {/* Google OAuth callback route */}
            <Route path="/auth/callback/google" element={<AuthCallback />} />
            
            {/* Redirect legacy paths */}
            <Route path="/repository/create" element={<Navigate to="/create" replace />} />
            <Route path="/repository/:id" element={<Navigate to="/home" replace />} />
            <Route path="/repo/:id" element={<Navigate to="/home" replace />} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
