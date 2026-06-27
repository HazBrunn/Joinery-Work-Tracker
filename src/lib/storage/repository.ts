// Storage abstraction. The app talks to this interface only, so the backend
// (localStorage now, Firebase later) can be swapped without touching the UI.
import { AppData } from '../../types';

export interface Repository {
  /** Load the entire dataset. */
  load(): Promise<AppData>;
  /** Persist the entire dataset. Simple whole-document save keeps the model trivial. */
  save(data: AppData): Promise<void>;
  /**
   * Store an image and return a URL to reference it.
   * - Local backend: returns a self-contained data URL.
   * - Firebase backend: uploads to Storage and returns the download URL.
   */
  uploadImage(file: File, jobId: string): Promise<string>;
  /** Human label for the active backend, shown in Settings. */
  readonly backendName: string;
}
