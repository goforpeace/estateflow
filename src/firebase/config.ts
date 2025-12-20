// This configuration is used for local development.
// For production deployments on Vercel, environment variables are used.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCjmUWhqhIqDsOjr6hIlI_VGrPSE2Et6JQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-2621369784-a94b2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-2621369784-a94b2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "452904291416",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:452904291416:web:b973ce82afc733a3b30e2d"
};
