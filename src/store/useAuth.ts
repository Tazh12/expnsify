import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import { auth } from '../services/firebase';

// iOS client ID from GoogleService-Info.plist
const IOS_CLIENT_ID = '731021875778-laus2dhcqbcbc81pvqj3ddb8vepfaokm.apps.googleusercontent.com';

interface AuthState {
  user: User | null;
  /** Bumped when the same user object changes in place (linking, profile edits). */
  rev: number;
  initializing: boolean;
  setUser: (user: User | null) => void;
  setInitializing: (v: boolean) => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  signInApple: () => Promise<void>;
  signInWithProvider: (credential: AuthCredential) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

function errorCode(e: unknown): string {
  return typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  rev: 0,
  initializing: true,
  setUser: (user) => set({ user }),
  setInitializing: (v) => set({ initializing: v }),

  signInEmail: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  },

  registerEmail: async (email, password, displayName) => {
    const current = auth.currentUser;
    // A guest keeps their uid, and so their data, when they create an account.
    const cred = current?.isAnonymous
      ? await linkWithCredential(current, EmailAuthProvider.credential(email, password))
      : await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    set({ user: cred.user, rev: get().rev + 1 });
  },

  signInGuest: async () => {
    await signInAnonymously(auth);
  },

  signInWithProvider: async (credential) => {
    const current = auth.currentUser;
    if (!current?.isAnonymous) {
      await signInWithCredential(auth, credential);
      return;
    }
    try {
      const linked = await linkWithCredential(current, credential);
      set({ user: linked.user, rev: get().rev + 1 });
    } catch (e) {
      if (errorCode(e) !== 'auth/credential-already-in-use') throw e;
      // That Apple or Google account already has Vadri data. Switch to it.
      const existing = OAuthProvider.credentialFromError(e as never)
        ?? GoogleAuthProvider.credentialFromError(e as never)
        ?? credential;
      await signInWithCredential(auth, existing);
    }
  },

  signInApple: async () => {
    if (Platform.OS !== 'ios') return;
    // Native modules: required lazily so the web bundle never loads them.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AppleAuthentication = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const apple = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!apple.identityToken) throw new Error('Apple did not return a sign-in token.');

    const credential = new OAuthProvider('apple.com').credential({
      idToken: apple.identityToken,
      rawNonce,
    });
    await get().signInWithProvider(credential);

    // Apple sends the name only on the first sign-in. Keep it then.
    const name = [apple.fullName?.givenName, apple.fullName?.familyName].filter(Boolean).join(' ');
    if (name && auth.currentUser && !auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { displayName: name });
      set({ user: auth.currentUser, rev: get().rev + 1 });
    }
  },

  updateDisplayName: async (name) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    // Force Zustand to re-render with the updated user object
    set({ user: { ...auth.currentUser } as User });
  },

  signOut: async () => {
    await firebaseSignOut(auth);
  },

  sendPasswordReset: async (email) => {
    await sendPasswordResetEmail(auth, email);
  },
}));

export function isCancelledSignIn(e: unknown): boolean {
  const code = errorCode(e);
  return code === 'ERR_REQUEST_CANCELED'
    || code === 'auth/popup-closed-by-user'
    || code === 'auth/cancelled-popup-request';
}

export { IOS_CLIENT_ID, GoogleAuthProvider, signInWithCredential, auth as firebaseAuth };
export { onAuthStateChanged };
