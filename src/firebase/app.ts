import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

/**
 * Web config for the "micenae-ef391" Firebase project. These values identify the project;
 * they are not secrets (access is enforced by Auth + firestore.rules). Restrict the API key
 * to your domains in Google Cloud Console › APIs & Services › Credentials.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyC1suYdXUi_oM3_ANNnLQ-sZBvGtTHr37o',
  authDomain: 'micenae-ef391.firebaseapp.com',
  projectId: 'micenae-ef391',
  storageBucket: 'micenae-ef391.firebasestorage.app',
  messagingSenderId: '610228639062',
  appId: '1:610228639062:web:cfcc5e3ba0b32e60eab2f7',
};

export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Offline-first: reads come from a local IndexedDB cache, writes queue while offline.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
