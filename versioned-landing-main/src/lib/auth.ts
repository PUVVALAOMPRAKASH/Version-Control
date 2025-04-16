/**
 * Google OAuth Authentication utilities
 */

export type Provider = 'google';

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  error?: string;
  token?: string;
}

/**
 * Initiate Google OAuth login flow
 */
export const initiateOAuthLogin = async (provider: Provider): Promise<void> => {
  // In a real implementation, this would redirect to Google OAuth endpoint
  // For demo purposes, we'll just log the action
  
  console.log(`Initiating Google login`);
  
  // Example redirect to Google OAuth
  // const redirectUri = `${window.location.origin}/auth/callback/google`;
  // const googleOAuthUrl = getGoogleOAuthUrl(redirectUri);
  // window.location.href = googleOAuthUrl;
};

/**
 * Initiate Google OAuth signup flow
 */
export const initiateOAuthSignup = async (provider: Provider): Promise<void> => {
  // Similar to login, but may include additional parameters
  console.log(`Initiating Google signup`);
  
  // Example redirect with signup intent
  // const redirectUri = `${window.location.origin}/auth/callback/google`;
  // const googleOAuthUrl = getGoogleOAuthUrl(redirectUri, { prompt: 'select_account' });
  // window.location.href = googleOAuthUrl;
};

/**
 * Handle Google OAuth callback and exchange code for token
 */
export const handleOAuthCallback = async (
  provider: Provider,
  code: string
): Promise<AuthResponse> => {
  // In a real implementation, this would:
  // 1. Exchange the code for a Google access token
  // 2. Fetch user information using the access token
  // 3. Create or update user in your database
  // 4. Generate a session token
  
  console.log(`Processing Google OAuth callback with code ${code}`);
  
  // Simulate API response
  return {
    success: true,
    user: {
      id: 'user123',
      name: 'Demo User',
      email: 'demo@example.com',
      avatar: 'https://ui-avatars.com/api/?name=Demo+User',
    },
    token: 'mock-auth-token-1234567890',
  };
};

/**
 * Google OAuth configuration
 */
export const getGoogleOAuthConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  redirectUri: `${window.location.origin}/auth/callback/google`,
  scope: 'email profile',
});

/**
 * Generate Google OAuth URL with necessary parameters
 */
export const getGoogleOAuthUrl = (redirectUri: string, options?: { prompt?: string }) => {
  const config = getGoogleOAuthConfig();
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scope,
    access_type: 'offline',
    // Add a state parameter for CSRF protection
    state: generateRandomState(),
  });
  
  // Add optional parameters
  if (options?.prompt) {
    params.append('prompt', options.prompt);
  }
  
  return `${baseUrl}?${params.toString()}`;
};

/**
 * Generate random state for CSRF protection
 */
const generateRandomState = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}; 