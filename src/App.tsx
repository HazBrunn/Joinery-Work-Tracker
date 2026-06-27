import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useData } from './store/DataContext';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './screens/Dashboard';
import { Clients } from './screens/Clients';
import { ClientDetail } from './screens/ClientDetail';
import { Jobs } from './screens/Jobs';
import { JobDetail } from './screens/JobDetail';
import { Calendar } from './screens/Calendar';
import { Finances } from './screens/Finances';
import { SettingsScreen } from './screens/Settings';

export default function App() {
  const { data, loading } = useData();

  // Apply theme to the document root.
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
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
