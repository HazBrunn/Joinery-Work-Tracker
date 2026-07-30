// localStorage-backed repository — the default, zero-config backend.
import { AppData, DEFAULT_SETTINGS, emptyData } from '../../types';
import { Repository } from './repository';

const KEY = 'joinery-jobs-tracker:data';

export class LocalRepository implements Repository {
  readonly backendName = 'Local (this device)';
  readonly seedsDemoData = true;

  async load(): Promise<AppData> {
    const raw = localStorage.getItem(KEY);
    // No key at all is a true first run — the only case that may resolve empty.
    if (!raw) return emptyData();
    let parsed: Partial<AppData>;
    try {
      parsed = JSON.parse(raw) as Partial<AppData>;
    } catch (err) {
      // Corrupt payload. Throw rather than resolving empty: the saved string is
      // still on disk and recoverable by hand, and resolving empty here would
      // invite the caller to seed demo data straight over the top of it.
      console.error('Local data is corrupt and was not loaded', err);
      throw new Error('Saved data on this device could not be read.');
    }
    // Merge defensively so older saved data still loads after schema growth.
    return {
      clients: parsed.clients ?? [],
      jobs: parsed.jobs ?? [],
      expenses: parsed.expenses ?? [],
      calendarBlocks: parsed.calendarBlocks ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  // Local backend keeps images self-contained as data URLs (no external storage).
  async uploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
