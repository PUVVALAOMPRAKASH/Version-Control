import { ReactNode, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';

interface RedirectIfAuthenticatedProps {
  children: ReactNode;
  redirectTo: string;
}

const RedirectIfAuthenticated = ({ 
  children, 
  redirectTo = '/home' 
}: RedirectIfAuthenticatedProps) => {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && currentUser) {
      navigate(redirectTo);
    }
  }, [currentUser, loading, navigate, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-brand-purple" />
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to={redirectTo} />;
  }

  return <>{children}</>;
};

export default RedirectIfAuthenticated; 