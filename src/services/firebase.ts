import { initializeApp } from 'firebase/app';
// @ts-ignore — @firebase/auth's exports map types getReactNativePersistence away for non-RN builds, but Metro resolves the correct RN build at runtime.
import { getReactNativePersistence, initializeAuth } from '@firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAoWSmnr7S-dkGR2JcKYaimgYbzzt53k_A',
  authDomain: 'expense-tracker-da669.firebaseapp.com',
  projectId: 'expense-tracker-da669',
  storageBucket: 'expense-tracker-da669.firebasestorage.app',
  messagingSenderId: '731021875778',
  appId: '1:731021875778:ios:078639cb18f15b9010abdb',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = initializeFirestore(app, {});
