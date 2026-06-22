import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAoWSmnr7S-dkGR2JcKYaimgYbzzt53k_A',
  authDomain: 'expense-tracker-da669.firebaseapp.com',
  projectId: 'expense-tracker-da669',
  storageBucket: 'expense-tracker-da669.firebasestorage.app',
  messagingSenderId: '731021875778',
  appId: '1:731021875778:ios:078639cb18f15b9010abdb',
};

const app = initializeApp(firebaseConfig);

// Metro resolves the 'react-native' export condition automatically,
// which includes AsyncStorage-backed persistence out of the box.
export const auth = getAuth(app);
export const db = getFirestore(app);
