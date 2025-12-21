'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // useMemo ensures this is only called once on the client.
  const services = useMemo(() => {
    if (!firebaseConfig.apiKey) {
      console.error("Firebase config not found or is incomplete. Please check your environment variables.");
      // Return null services if config is not available.
      // The provider will handle the null state gracefully.
      return { app: null, auth: null, firestore: null };
    }
      
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    return { app, auth, firestore };
  }, []);

  // Pass nulls if services aren't initialized. The provider handles this.
  return (
    <FirebaseProvider
      firebaseApp={services.app!}
      auth={services.auth!}
      firestore={services.firestore!}
    >
      {children}
    </FirebaseProvider>
  );
}
