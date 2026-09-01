import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAoWSmnr7S-dkGR2JcKYaimgYbzzt53k_A',
  authDomain: 'expense-tracker-da669.firebaseapp.com',
  projectId: 'expense-tracker-da669',
  storageBucket: 'expense-tracker-da669.firebasestorage.app',
  messagingSenderId: '731021875778',
  appId: '1:731021875778:ios:078639cb18f15b9010abdb',
};

const app = initializeApp(firebaseConfig);

function makeAuth() {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    // RN-only export — importing it at the top level blanks the web bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('@firebase/auth');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = makeAuth();

function makeDb() {
  try {
    if (Platform.OS === 'web') {
      return initializeFirestore(app, { localCache: persistentLocalCache() });
    }
    return initializeFirestore(app, {});
  } catch {
    return getFirestore(app);
  }
}

export const db = makeDb();

export const storage = getStorage(app);
