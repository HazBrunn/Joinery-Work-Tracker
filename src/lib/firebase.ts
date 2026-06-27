// Firebase initialisation — Firestore (database), Storage (photos), and anonymous
// Auth so security rules can require an authenticated request. All config values
// here are the public web-app config (safe to ship in the client bundle); access
// is controlled by Firestore/Storage security rules, not by hiding these keys.
import { initializeApp, FirebaseApp } from 'firebase/app';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';

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
  /** Resolves once anonymous sign-in has completed (or failed gracefully). */
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
    const authReady = signInAnonymously(auth)
      .then(() => undefined)
      .catch((err) => {
        console.error(
          'Firebase anonymous sign-in failed. Enable Anonymous auth in the Firebase console.',
          err,
        );
      });
    handles = { app, db, storage, auth, authReady };
  }
  return handles;
}
