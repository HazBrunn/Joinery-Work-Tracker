import { Screen } from '../components/Screen';
import { Field } from '../components/ui';
import { useData } from '../store/DataContext';
import { gbp2 } from '../lib/format';
import type { User } from '../lib/firebase';

interface Props {
  onSignOut?: () => Promise<void>;
  authUser: User | null;
}

export function SettingsScreen({ onSignOut, authUser }: Props) {
  const { data, updateSettings, backendName, loadDemo, clearAll } = useData();
  const s = data.settings;

  return (
    <Screen title="Settings" back>
      <div className="section-title" style={{ marginTop: 0 }}>
        Appearance
      </div>
      <div className="card pad">
        <Field label="Theme">
          <div className="segmented">
            <button className={s.theme === 'light' ? 'active' : ''} onClick={() => updateSettings({ theme: 'light' })}>
              ☀️ Light
            </button>
            <button className={s.theme === 'dark' ? 'active' : ''} onClick={() => updateSettings({ theme: 'dark' })}>
              🌙 Dark
            </button>
          </div>
        </Field>
      </div>

      <div className="section-title">Business</div>
      <div className="card pad stack">
        <Field label="Business name">
          <input
            className="input"
            value={s.businessName}
            onChange={(e) => updateSettings({ businessName: e.target.value })}
          />
        </Field>
        <div className="field-row">
          <Field label="Default day rate (£)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={s.defaultDayRate}
              onChange={(e) => updateSettings({ defaultDayRate: +e.target.value })}
            />
          </Field>
          <Field label="Working hours / day">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={s.workingHoursPerDay}
              onChange={(e) => updateSettings({ workingHoursPerDay: +e.target.value || 8 })}
            />
          </Field>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          {gbp2(s.defaultDayRate / (s.workingHoursPerDay || 8))}/hour · used as the default on new jobs and for
          day↔hour conversion and capacity planning.
        </p>
      </div>

      {authUser && (
        <>
          <div className="section-title">Account</div>
          <div className="card pad stack-sm">
            <div className="summary-line" style={{ padding: 0 }}>
              <span className="muted">Signed in as</span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                {authUser.email ?? authUser.displayName ?? 'Google account'}
              </span>
            </div>
            <div className="summary-line" style={{ padding: 0 }}>
              <span className="muted">Your user ID</span>
              <span className="mono" style={{ fontSize: '0.75rem' }}>{authUser.uid}</span>
            </div>
            <p className="tiny" style={{ margin: 0 }}>
              To lock data strictly to your account, update <code>firebase/firestore.rules</code> to check{' '}
              <code>request.auth.uid == "{authUser.uid}"</code>.
            </p>
            <div className="divider" />
            {onSignOut && (
              <button
                className="btn"
                onClick={() => {
                  if (confirm('Sign out of Joinery Tracker?')) void onSignOut();
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </>
      )}

      <div className="section-title">Data</div>
      <div className="card pad stack-sm">
        <div className="summary-line" style={{ padding: 0 }}>
          <span className="muted">Storage</span>
          <span style={{ fontWeight: 700 }}>{backendName}</span>
        </div>
        <div className="divider" />
        <button
          className="btn"
          onClick={() => {
            if (confirm('Reload the demo dataset? This replaces current data.')) loadDemo();
          }}
        >
          Reload demo data
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Delete ALL clients, jobs, expenses and calendar blocks? This cannot be undone.')) clearAll();
          }}
        >
          Clear all business data
        </button>
      </div>

      <p className="tiny" style={{ textAlign: 'center', marginTop: 24 }}>
        Joinery Jobs Tracker · v1.0 · built from the v2 blueprint
      </p>
    </Screen>
  );
}
