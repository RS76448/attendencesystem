import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDac2D96TJYOoeO1GB0cuJAFqJLV3tgISM",
  authDomain: "prime-rainfall-321012.firebaseapp.com",
  projectId: "prime-rainfall-321012",
  storageBucket: "prime-rainfall-321012.firebasestorage.app",
  messagingSenderId: "484730560750",
  appId: "1:484730560750:web:c58bd376614e550d9bd3ff"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);