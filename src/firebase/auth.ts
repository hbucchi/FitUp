import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, USE_EMULATORS } from './app';

/** undefined = still checking, null = signed out */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(auth.currentUser ?? undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Some mobile browsers / installed PWAs block popups — fall back to a full-page redirect.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    throw e;
  }
}

export const signOut = () => fbSignOut(auth);

// Test hook: with the Auth emulator, sign in with a fake Google identity (no real Google account).
if (USE_EMULATORS) {
  (window as unknown as Record<string, unknown>).__micenaeTestSignIn = (sub: string, email: string) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true })));
}
