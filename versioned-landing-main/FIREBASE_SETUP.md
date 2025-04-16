# Firebase Authentication Setup

This application uses Firebase for authentication and user management. Follow these steps to set up Firebase for this project.

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the steps to create a new project
3. Give your project a name (e.g. "VersionControl")
4. Decide whether to enable Google Analytics (recommended)
5. Accept the terms and create the project

## 2. Register Your Web App

1. In the Firebase console, click on the web icon (</>) to add a web app
2. Give your app a nickname (e.g. "VersionControl Web App")
3. Check the box for "Also set up Firebase Hosting" if you plan to deploy with Firebase
4. Click "Register app"
5. Keep the Firebase configuration values for the next step

## 3. Configure Environment Variables

1. Create a `.env` file at the root of the project (copy from `.env.example`)
2. Add your Firebase configuration values to the `.env` file:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## 4. Enable Authentication Methods

1. In the Firebase console, go to "Authentication" in the left sidebar
2. Click on "Get started" or "Sign-in method" tab
3. Enable "Email/Password" authentication
4. Enable "Google" authentication
   - Configure the OAuth consent screen if prompted
   - Add your domain to the authorized domains list

## 5. Set Up Firestore Database (Optional)

If you want to use Firestore for data storage:

1. In the Firebase console, go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose either "Start in production mode" or "Start in test mode" (for development)
4. Select a database location close to your users
5. Click "Enable"

## 6. Security Rules

For Firestore, set up basic security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add rules for other collections as needed
  }
}
```

## 7. Run the Application

Start the application with:

```
npm run dev
```

Your application should now be using Firebase for authentication!

## Features Enabled

- Email/Password Sign Up and Login
- Google Sign-In
- User Profile Storage
- Session Management
- Protected Routes

## Authentication Flow

1. Users can sign up with email/password or Google
2. After successful authentication, users are redirected to the dashboard
3. User session persists across browser refreshes
4. Protected routes redirect unauthenticated users to the login page
5. User profile information is stored in Firestore for additional data

## Code Structure

- `src/lib/firebase.ts` - Firebase initialization
- `src/lib/authService.ts` - Authentication service functions
- `src/lib/AuthContext.tsx` - Authentication context provider
- `src/components/ProtectedRoute.tsx` - Protected route component
- Login/Signup pages with Firebase auth integration

## Further Customization

You can expand the authentication system by:

1. Adding more social providers (GitHub, Microsoft, etc.)
2. Implementing email verification
3. Adding password reset functionality
4. Creating user roles and permissions
5. Adding two-factor authentication 