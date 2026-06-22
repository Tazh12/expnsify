import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { auth } from '../services/firebase';

// iOS client ID from GoogleService-Info.plist
const IOS_CLIENT_ID = '731021875778-laus2dhcqbcbc81pvqj3ddb8vepfaokm.apps.googleusercontent.com';

interface AuthState {
  user: User | null;
  initializing: boolean;
  setUser: (user: User | null) => void;
  setInitializing: (v: boolean) => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, displayName: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  setUser: (user) => set({ user }),
  setInitializing: (v) => set({ initializing: v }),

  signInEmail: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  },

  registerEmail: async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
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
}));

export { IOS_CLIENT_ID, GoogleAuthProvider, signInWithCredential, auth as firebaseAuth };
export { onAuthStateChanged };
