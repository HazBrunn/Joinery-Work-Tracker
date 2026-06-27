import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', icon: '🏠', label: 'Dashboard', end: true },
  { to: '/clients', icon: '👥', label: 'Clients' },
  { to: '/jobs', icon: '🔨', label: 'Jobs' },
  { to: '/calendar', icon: '📅', label: 'Calendar' },
  { to: '/finances', icon: '💷', label: 'Finances' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
