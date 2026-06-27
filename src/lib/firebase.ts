// Firebase initialisation — Firestore (database), Storage (photos), and Google
// Auth so only the owner's Google account can read/write data. All config values
// here are the public web-app config (safe to ship in the client bundle); access
// is controlled by Firestore/Storage security rules, not by hiding these keys.
import { initializeApp, FirebaseApp } from 'firebase/app';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when enough Firebase config is present to connect. */
export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

interface FirebaseHandles {
  app: FirebaseApp;
  db: Firestore;
  storage: FirebaseStorage;
  auth: Auth;
  /** Resolves once a signed-in Google user is detected. Since App.tsx gates
   *  DataProvider behind auth, this resolves almost immediately after mounting. */
  authReady: Promise<void>;
}

let handles: FirebaseHandles | null = null;

export function getFirebase(): FirebaseHandles {
  if (!handles) {
    const app = initializeApp(config);
    // ignoreUndefinedProperties lets us persist objects that contain optional
    // fields left as `undefined` (e.g. an unscheduled task's deadline) without
    // Firestore throwing — matching the local backend's tolerance.
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    const storage = getStorage(app);
    const auth = getAuth(app);
    const authReady = new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, (user: User | null) => {
        if (user) {
          unsub();
          resolve();
        }
      });
    });
    handles = { app, db, storage, auth, authReady };
  }
  return handles;
}

/** Open a Google sign-in popup. Called from the Login screen. */
export async function signInWithGoogle(): Promise<void> {
  const { auth } = getFirebase();
  await signInWithPopup(auth, new GoogleAuthProvider());
}

/** Sign out and return to the login screen. */
export async function signOutUser(): Promise<void> {
  const { auth } = getFirebase();
  await signOut(auth);
}

export type { User };
export { onAuthStateChanged };
