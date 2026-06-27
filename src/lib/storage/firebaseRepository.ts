// Firebase-backed repository — cloud sync (Firestore) + photo storage (Storage).
//
// The whole dataset is stored as a single JSON document at `app_state/main`,
// keeping the swap from local storage trivial while giving real cross-device sync.
// Photos are NOT embedded in that document (Firestore caps documents at 1 MiB);
// uploadImage() pushes the file to Firebase Storage and returns its download URL,
// which is what gets stored on the photo record instead.
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { AppData, DEFAULT_SETTINGS, emptyData } from '../../types';
import { getFirebase } from '../firebase';
import { Repository } from './repository';

const COLLECTION = 'app_state';
const DOC_ID = 'main';

export class FirebaseRepository implements Repository {
  readonly backendName = 'Firebase (cloud sync)';

  async load(): Promise<AppData> {
    const { db, authReady } = getFirebase();
    await authReady;
    try {
      const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
      if (!snap.exists()) return emptyData();
      const parsed = (snap.data().document ?? {}) as Partial<AppData>;
      return {
        clients: parsed.clients ?? [],
        jobs: parsed.jobs ?? [],
        expenses: parsed.expenses ?? [],
        calendarBlocks: parsed.calendarBlocks ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch (err) {
      console.error('Firebase load failed', err);
      return emptyData();
    }
  }

  async save(data: AppData): Promise<void> {
    const { db, authReady } = getFirebase();
    await authReady;
    try {
      await setDoc(doc(db, COLLECTION, DOC_ID), {
        document: data,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Firebase save failed', err);
    }
  }

  async uploadImage(file: File, jobId: string): Promise<string> {
    const { storage, authReady } = getFirebase();
    await authReady;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `job-photos/${jobId}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
}
