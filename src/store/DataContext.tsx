// Central data store. Loads once from the active repository, holds the dataset in
// React state, and persists on every change (debounced). All modules read/write
// through the helpers here so persistence stays in one place.
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppData, emptyData, Settings } from '../types';
import { createRepository, Repository } from '../lib/storage';
import { seedData } from '../lib/seed';

interface DataContextValue {
  data: AppData;
  loading: boolean;
  backendName: string;
  /** Replace the whole dataset (used by import / seed / clear). */
  setData: (next: AppData) => void;
  /** Mutate via a producer that receives a draft copy. */
  update: (mutator: (draft: AppData) => void) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  loadDemo: () => void;
  clearAll: () => void;
  /** Store an image via the active backend, returning a URL to reference it. */
  uploadImage: (file: File, jobId: string) => Promise<string>;
}

const DataContext = createContext<DataContextValue | null>(null);

const SEEDED_FLAG = 'joinery-jobs-tracker:seeded';

export function DataProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repository>(createRepository());
  const [data, setDataState] = useState<AppData>(emptyData());
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load. Seed demo data on a truly first run (no saved data, no flag).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await repoRef.current.load();
      const isEmpty =
        loaded.clients.length === 0 &&
        loaded.jobs.length === 0 &&
        loaded.expenses.length === 0;
      const alreadySeeded = localStorage.getItem(SEEDED_FLAG) === '1';
      if (cancelled) return;
      if (isEmpty && !alreadySeeded) {
        const seeded = seedData();
        setDataState(seeded);
        await repoRef.current.save(seeded);
        localStorage.setItem(SEEDED_FLAG, '1');
      } else {
        setDataState(loaded);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: AppData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void repoRef.current.save(next);
    }, 250);
  }, []);

  const setData = useCallback(
    (next: AppData) => {
      setDataState(next);
      persist(next);
    },
    [persist],
  );

  const update = useCallback(
    (mutator: (draft: AppData) => void) => {
      setDataState((prev) => {
        // Shallow structural clone is enough since we replace arrays we touch.
        const draft: AppData = {
          clients: [...prev.clients],
          jobs: prev.jobs.map((j) => ({ ...j })),
          expenses: [...prev.expenses],
          calendarBlocks: [...prev.calendarBlocks],
          settings: { ...prev.settings },
        };
        mutator(draft);
        persist(draft);
        return draft;
      });
    },
    [persist],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((draft) => {
        draft.settings = { ...draft.settings, ...patch };
      });
    },
    [update],
  );

  const loadDemo = useCallback(() => {
    const seeded = seedData();
    setData(seeded);
    localStorage.setItem(SEEDED_FLAG, '1');
  }, [setData]);

  const clearAll = useCallback(() => {
    const blank = emptyData();
    // keep current settings (theme/rates) on a wipe of business data
    setDataState((prev) => {
      blank.settings = { ...prev.settings };
      void repoRef.current.save(blank);
      return blank;
    });
    localStorage.setItem(SEEDED_FLAG, '1');
  }, []);

  const uploadImage = useCallback(
    (file: File, jobId: string) => repoRef.current.uploadImage(file, jobId),
    [],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      loading,
      backendName: repoRef.current.backendName,
      setData,
      update,
      updateSettings,
      loadDemo,
      clearAll,
      uploadImage,
    }),
    [data, loading, setData, update, updateSettings, loadDemo, clearAll, uploadImage],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
