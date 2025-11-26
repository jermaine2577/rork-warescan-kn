import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyD3ZoJx9Y7KpQm5VxLqBwN8Rt4Uf2Gh6Ik",
  authDomain: "shipitforless-inventory.firebaseapp.com",
  projectId: "shipitforless-inventory",
  storageBucket: "shipitforless-inventory.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789",
  iosBundleId: "app.rork.mrk54opr365nuifvcfrsm-9xo1ldcc"
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isInitialized = false;

export async function initializeFirebase(): Promise<void> {
  if (isInitialized) return;
  
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    
    if (Platform.OS === 'web') {
      try {
        await enableIndexedDbPersistence(db);
        console.log('✓ Firestore offline persistence enabled for web');
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence enabled in first tab only');
        } else if (err.code === 'unimplemented') {
          console.warn('Browser doesn\'t support persistence');
        }
      }
    }
    
    isInitialized = true;
    console.log('✓ Firebase initialized successfully for', Platform.OS);
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    app = null;
    db = null;
    auth = null;
  }
}

export function getDb(): Firestore | null {
  if (!isInitialized && !db) {
    initializeFirebase().catch(err => console.error('Lazy Firebase init failed:', err));
  }
  return db;
}

export function getAuthInstance(): Auth | null {
  if (!isInitialized && !auth) {
    initializeFirebase().catch(err => console.error('Lazy Firebase init failed:', err));
  }
  return auth;
}

export { app, db, auth };
