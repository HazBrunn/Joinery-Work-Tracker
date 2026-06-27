import { NavLink } from 'react-router-dom';
import { useData } from '../store/DataContext';

const TABS = [
  { to: '/', icon: '🏠', label: 'Dashboard', end: true },
  { to: '/clients', icon: '👥', label: 'Clients' },
  { to: '/jobs', icon: '🔨', label: 'Jobs' },
  { to: '/calendar', icon: '📅', label: 'Calendar' },
  { to: '/finances', icon: '💷', label: 'Finances' },
];

// Desktop-only left navigation. Hidden via CSS below the desktop breakpoint,
// where the bottom tab bar takes over instead.
export function Sidebar({ onSignOut }: { onSignOut?: () => Promise<void> }) {
  const { data } = useData();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img className="logo" src="./favicon.svg" alt="" />
        <span>{data.settings.businessName || 'Joinery'}</span>
      </div>
      <nav className="sidebar-nav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">⚙️</span>
          Settings
        </NavLink>
        {onSignOut && (
          <button className="sidebar-signout" onClick={() => void onSignOut()}>
            <span className="nav-icon">🔓</span>
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
