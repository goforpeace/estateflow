// This configuration is used for local development and for Vercel deployments.

// For local development, create a .env.local file in your root directory and
// add your Firebase configuration there.
// Example .env.local:
// NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
// ... and so on for all the keys.

// For production deployments on Vercel, these variables are automatically replaced
// by Vercel's build process with the secrets you have configured in your project settings.

export const firebaseConfig = {
  apiKey: "@firebase_api_key",
  authDomain: "@firebase_auth_domain",
  projectId: "@firebase_project_id",
  storageBucket: "@firebase_storage_bucket",
  messagingSenderId: "@firebase_messaging_sender_id",
  appId: "@firebase_app_id"
};
