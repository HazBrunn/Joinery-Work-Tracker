import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { firebaseConfigured, getFirebase, signOutUser } from './lib/firebase';
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

// True when the Firebase backend is active (baked in at build time by Vite).
const USE_FIREBASE = import.meta.env.VITE_DATA_BACKEND === 'firebase' && firebaseConfigured();

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  // If Firebase isn't in use, skip the auth check entirely.
  const [authChecked, setAuthChecked] = useState(!USE_FIREBASE);

  useEffect(() => {
    if (!USE_FIREBASE) return;
    const { auth } = getFirebase();
    // onAuthStateChanged fires immediately with the persisted session (if any),
    // so the loading flash is typically <200 ms.
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="app">
        <div className="spinner-wrap">Loading…</div>
      </div>
    );
  }

  if (USE_FIREBASE && !authUser) {
    return <Login />;
  }

  // DataProvider only mounts after auth is confirmed, so load() is only called
  // once the user is signed in and authReady resolves immediately.
  return (
    <DataProvider>
      <AppContent onSignOut={USE_FIREBASE ? signOutUser : undefined} authUser={authUser} />
    </DataProvider>
  );
}

function AppContent({
  onSignOut,
  authUser,
}: {
  onSignOut?: () => Promise<void>;
  authUser: User | null;
}) {
  const { data, loading } = useData();

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
