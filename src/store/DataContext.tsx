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
  /**
   * Set when the initial load failed. While it is set the app must not be used:
   * the in-memory dataset is empty but the stored one is not, so writing would
   * destroy real records. Persistence is disabled until a successful reload.
   */
  loadError: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors loadError for the persist path, which needs the current value
  // without being re-created (and re-debounced) on every render.
  const blockedRef = useRef(false);

  // Initial load. Seed demo data on a truly first run (no saved data, no flag).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: AppData;
      try {
        loaded = await repoRef.current.load();
      } catch (err) {
        // The store has data we could not read. Do NOT seed and do NOT save —
        // either would overwrite real records with an empty or demo dataset.
        if (cancelled) return;
        console.error('Initial load failed; persistence disabled', err);
        blockedRef.current = true;
        setLoadError(err instanceof Error ? err.message : 'Your data could not be loaded.');
        setLoading(false);
        return;
      }
      const isEmpty =
        loaded.clients.length === 0 &&
        loaded.jobs.length === 0 &&
        loaded.expenses.length === 0;
      const alreadySeeded = localStorage.getItem(SEEDED_FLAG) === '1';
      if (cancelled) return;
      // Reaching here means load() succeeded, so "empty" is genuinely empty.
      // Only the local backend fills that in with demo data: an empty cloud
      // account is usually one you have just signed into and are about to
      // restore a backup onto, and inventing clients and jobs in a real
      // database is worse than showing nothing.
      if (isEmpty && !alreadySeeded && repoRef.current.seedsDemoData) {
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

  // Re-read when the app comes back to the foreground.
  //
  // save() rewrites every one of this user's rows from what is held here, so a
  // tab left open on a stale copy would undo anything changed elsewhere the
  // moment you touched it — and the life tracker can now tick a job task off.
  // Refreshing on the way back in closes that, because the stale copy is
  // replaced before anything can be saved over the top of the real one.
  //
  // Deliberately setDataState and not setData: this is reading what is already
  // stored, not a change to store.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || blockedRef.current) return;
      repoRef.current
        .load()
        .then((fresh) => setDataState(fresh))
        .catch(() => {
          /* offline, or a transient failure — keep what is on screen and let
             the next save carry it, exactly as before this existed */
        });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const persist = useCallback((next: AppData) => {
    // Last line of defence: never write when the initial load failed.
    if (blockedRef.current) return;
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
    if (blockedRef.current) return;
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
      loadError,
      backendName: repoRef.current.backendName,
      setData,
      update,
      updateSettings,
      loadDemo,
      clearAll,
      uploadImage,
    }),
    [data, loading, loadError, setData, update, updateSettings, loadDemo, clearAll, uploadImage],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
