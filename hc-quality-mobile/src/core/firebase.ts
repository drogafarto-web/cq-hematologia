import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  setPersistence,
  // @ts-ignore - react-native exports
  ReactNativeAsyncStorage
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: 'hmatologia2.firebaseapp.com',
  projectId: 'hmatologia2',
  storageBucket: 'hmatologia2.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_APP_ID!,
};

export const app = initializeApp(firebaseConfig);

// Initialize auth with AsyncStorage persistence for React Native
// Note: React Native SDK handles async storage automatically
export const auth = getAuth(app);

export const db = getFirestore(app);
export const functions = getFunctions(app, 'southamerica-east1');

// Emulator for local development
if (process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch (err) {
    console.log('[Firebase] Emulator already connected or error:', err);
  }
}

export default app;
