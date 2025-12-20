
// This configuration is used for local development and for Vercel deployments.

// For local development, create a .env.local file in your root directory and
// add your Firebase configuration there.
// Example .env.local:
// NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
// ... and so on for all the keys.

// For production deployments on Vercel, you must set these same environment
// variables in your Vercel project settings.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
