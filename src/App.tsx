import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase, supabaseConfigured, signOutUser as signOutSupabase } from './lib/supabase';
import { firebaseConfigured, getFirebase, onAuthStateChanged, signOutUser as signOutFirebase } from './lib/firebase';
import { themeById } from './types';
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

// Which backend is active, baked in at build time by Vite. Without either, the
// app runs on local storage with no sign-in, which is what makes a checkout
// with no environment still usable.
//
// Both are supported for the length of the move to Supabase: the Firebase
// backend has to stay readable until its data is across and verified. Once it
// is, everything Firebase here can go.
const BACKEND = import.meta.env.VITE_DATA_BACKEND;
const USE_SUPABASE = BACKEND === 'supabase' && supabaseConfigured();
const USE_FIREBASE = BACKEND === 'firebase' && firebaseConfigured();
const NEEDS_AUTH = USE_SUPABASE || USE_FIREBASE;

// The owner's Firebase UID, kept for the Firebase path only. On Supabase there
// is no allow-list and none is needed: every row carries a user_id and the RLS
// policy on it is the boundary, so another account signing in gets its own
// empty tracker and cannot read a client, a quote or a margin either way.
const OWNER_UID = import.meta.env.VITE_OWNER_UID || 'Zzrd3zL0gNQI1DsT263Dw8qfFKg1';

/** The bit of a signed-in user the app actually uses, from either provider. */
export interface Account {
  id: string;
  email?: string;
}

export default function App() {
  const [authUser, setAuthUser] = useState<Account | null>(null);
  const [authChecked, setAuthChecked] = useState(!NEEDS_AUTH);

  useEffect(() => {
    if (!USE_SUPABASE) return;
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      const u = data.session?.user;
      setAuthUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setAuthUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      setAuthChecked(true);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!USE_FIREBASE) return;
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user ? { id: user.uid, email: user.email ?? user.displayName ?? undefined } : null);
      setAuthChecked(true);
    });
  }, []);

  const signOut = USE_SUPABASE ? signOutSupabase : USE_FIREBASE ? signOutFirebase : undefined;

  if (!authChecked) {
    return (
      <div className="app">
        <div className="spinner-wrap">Loading…</div>
      </div>
    );
  }

  if (NEEDS_AUTH && !authUser) {
    return <Login firebase={USE_FIREBASE} />;
  }

  // Signed in on Firebase, but with the wrong Google account.
  if (USE_FIREBASE && authUser && authUser.id !== OWNER_UID) {
    return <NoAccess account={authUser.email} onSignOut={signOutFirebase} />;
  }

  // DataProvider only mounts once auth is settled, so load() never runs without
  // a session — which matters, because a signed-out load reads zero rows and
  // that must not be mistaken for an empty tracker.
  return (
    <DataProvider key={authUser?.id ?? 'local'}>
      <AppContent onSignOut={signOut} authUser={authUser} />
    </DataProvider>
  );
}

// Shown when someone signs in with a Google account that isn't the owner's.
function NoAccess({ account, onSignOut }: { account?: string; onSignOut: () => Promise<void> }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo" style={{ display: 'grid', placeItems: 'center', fontSize: 28 }}>🔒</div>
          <h1>No access</h1>
          <p className="muted">This is a private business tracker.</p>
        </div>
        <div className="divider" />
        <p className="tiny" style={{ textAlign: 'center', margin: '16px 0' }}>
          {account ? <>You're signed in as <strong>{account}</strong>, which isn't the owner of this tracker.</>
                   : <>This account isn't the owner of this tracker.</>}
          <br />
          Sign out and use the owner's account.
        </p>
        <button className="btn-google" onClick={() => void onSignOut()}>Sign out</button>
      </div>
    </div>
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
  authUser: Account | null;
}) {
  const { data, loading, loadError } = useData();

  useEffect(() => {
    const theme = themeById(data.settings.theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);
    // Alongside, so the handful of rules that need a different treatment in the
    // dark apply to every dark theme rather than only the one called "dark".
    if (theme.dark) root.setAttribute('data-dark', '');
    else root.removeAttribute('data-dark');
    root.style.colorScheme = theme.dark ? 'dark' : 'light';
    // The browser chrome takes the header's colour, which is --blue per theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.dark ? '#101b28' : theme.swatch[0]);
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
