import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, getCurrentUser } from './authService';

interface AuthContextProps {
  currentUser: User | null;
  loading: boolean;
  userProfile: UserProfile | null;
}

interface UserProfile {
  uid: string;
  username?: string;
  email?: string;
  photoURL?: string;
}

const AuthContext = createContext<AuthContextProps>({
  currentUser: null,
  loading: true,
  userProfile: null
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      setLoading(false);
      
      if (user) {
        setUserProfile({
          uid: user.uid,
          username: user.displayName || undefined,
          email: user.email || undefined,
          photoURL: user.photoURL || undefined
        });
      } else {
        setUserProfile(null);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    userProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 