import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// This component is not needed for Firebase as Firebase handles OAuth redirects automatically
// We'll keep it for compatibility with the existing routes but redirect to home
const AuthCallback = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    const redirectAfterAuth = () => {
      // If loading is done and we have a user, redirect to home
      if (!loading) {
        if (currentUser) {
          navigate('/home');
        } else {
          // If authentication failed, redirect to login
          navigate('/login');
        }
      }
    };

    // Wait a short time to allow Firebase to complete the auth process
    const timer = setTimeout(redirectAfterAuth, 1500);
    
    return () => clearTimeout(timer);
  }, [loading, currentUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-50 via-white to-white"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5"></div>
      
      <Card className="w-full max-w-md relative bg-white/80 backdrop-blur-sm border-gray-200 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold text-center text-gray-900">
            Completing Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center pt-4 pb-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-purple mx-auto mb-4" />
            <p className="text-gray-700">Please wait while we finish setting up your account...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback; 