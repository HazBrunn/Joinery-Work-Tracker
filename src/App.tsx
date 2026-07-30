import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, signOutUser } from './lib/supabase';
import { DataProvider } from './store/DataContext';
import { useData } from './store/DataContext';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Clients } from './screens/Clients';
import { ClientDetail } from './screens/ClientDetail';
import { Jobs } from './screens/Jobs';
import { JobDetail } from './screens/JobDetail';
import { Calendar } from './screens/Calendar';
import { Finances } from './screens/Finances';
import { SettingsScreen } from './screens/Settings';

// True when the Supabase backend is active (baked in at build time by Vite).
// Without it the app runs on local storage with no sign-in, which is what makes
// a checkout with no environment still usable.
const USE_SUPABASE = import.meta.env.VITE_DATA_BACKEND === 'supabase' && supabaseConfigured();

// There is no owner allow-list any more. Every row carries a user_id and the
// RLS policy on it is the boundary, so another account signing in gets its own
// empty tracker rather than a rejection screen — and, more to the point, cannot
// read a single client, quote or margin belonging to anyone else.

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  // If Supabase isn't in use, skip the auth check entirely.
  const [authChecked, setAuthChecked] = useState(!USE_SUPABASE);

  useEffect(() => {
    if (!USE_SUPABASE) return;
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setAuthUser(data.session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null);
      setAuthChecked(true);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  if (!authChecked) {
    return (
      <div className="app">
        <div className="spinner-wrap">Loading…</div>
      </div>
    );
  }

  if (USE_SUPABASE && !authUser) {
    return <Login />;
  }

  // DataProvider only mounts once auth is settled, so load() never runs without
  // a session — which matters, because a signed-out load reads zero rows and
  // that must not be mistaken for an empty tracker.
  return (
    <DataProvider key={authUser?.id ?? 'local'}>
      <AppContent onSignOut={USE_SUPABASE ? signOutUser : undefined} authUser={authUser} />
    </DataProvider>
  );
}

// Shown when the dataset could not be loaded. Deliberately offers only a retry:
// no route into the app, because every write path would risk the stored data.
function LoadFailed({ message }: { message: string }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo" style={{ display: 'grid', placeItems: 'center', fontSize: 28 }}>
            ⚠️
          </div>
          <h1>Can't load your data</h1>
          <p className="muted">{message}</p>
        </div>
        <div className="divider" />
        <p className="tiny" style={{ textAlign: 'center', margin: '16px 0' }}>
          Nothing has been changed or deleted — your records are still saved. The app stays locked
          until it can read them, so that nothing overwrites what's there.
        </p>
        <button className="btn-google" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  );
}

function AppContent({
  onSignOut,
  authUser,
}: {
  onSignOut?: () => Promise<void>;
  authUser: User | null;
}) {
  const { data, loading, loadError } = useData();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', data.settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', data.settings.theme === 'dark' ? '#101b28' : '#1E3A5F');
  }, [data.settings.theme]);

  if (loading) {
    return (
      <div className="app">
        <div className="spinner-wrap">Loading your workshop…</div>
      </div>
    );
  }

  // Your records exist but could not be read. Showing the app here would mean
  // showing an empty one, and the first edit would save that emptiness over the
  // top of them — so stop at a wall instead.
  if (loadError) {
    return <LoadFailed message={loadError} />;
  }

  return (
    <div className="app">
      <Sidebar onSignOut={onSignOut} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/settings" element={<SettingsScreen onSignOut={onSignOut} authUser={authUser} />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
