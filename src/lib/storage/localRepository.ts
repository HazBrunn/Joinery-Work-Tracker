// localStorage-backed repository — the default, zero-config backend.
import { AppData, DEFAULT_SETTINGS, emptyData } from '../../types';
import { Repository } from './repository';

const KEY = 'joinery-jobs-tracker:data';

export class LocalRepository implements Repository {
  readonly backendName = 'Local (this device)';

  async load(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw) as Partial<AppData>;
      // Merge defensively so older saved data still loads after schema growth.
      return {
        clients: parsed.clients ?? [],
        jobs: parsed.jobs ?? [],
        expenses: parsed.expenses ?? [],
        calendarBlocks: parsed.calendarBlocks ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch (err) {
      console.error('Failed to load local data, starting fresh', err);
      return emptyData();
    }
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
