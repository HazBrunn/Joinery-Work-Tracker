import { useRef, useState } from 'react';
import { Screen } from '../components/Screen';
import { Field } from '../components/ui';
import { useData } from '../store/DataContext';
import { gbp2 } from '../lib/format';
import { describe, exportBackup, parseBackup, summarise } from '../lib/backup';
import type { User } from '@supabase/supabase-js';

interface Props {
  onSignOut?: () => Promise<void>;
  authUser: User | null;
}

export function SettingsScreen({ onSignOut, authUser }: Props) {
  const { data, setData, updateSettings, backendName, loadDemo, clearAll } = useData();
  const s = data.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Restore is the one action here that can destroy a morning's work, so it
  // states both sides of the trade in the confirm and refuses anything it
  // can't parse cleanly.
  async function onRestoreFile(file?: File) {
    if (fileRef.current) fileRef.current.value = ''; // allow re-picking the same file
    if (!file) return;
    setNotice(null);
    let incoming;
    try {
      incoming = parseBackup(await file.text());
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'That file could not be read.' });
      return;
    }
    const now = describe(summarise(data));
    const next = describe(summarise(incoming));
    const ok = confirm(
      `Restore this backup?\n\nIn the app now: ${now}\nIn the backup: ${next}\n\n` +
        `Everything currently in the app will be replaced. Export a backup first if you haven't.`,
    );
    if (!ok) return;
    setData(incoming);
    setNotice({ kind: 'ok', text: `Restored ${next}.` });
  }

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
                {authUser.email ?? 'Signed in'}
              </span>
            </div>
            <div className="summary-line" style={{ padding: 0 }}>
              <span className="muted">Your user ID</span>
              <span className="mono" style={{ fontSize: '0.75rem' }}>{authUser.id}</span>
            </div>
            <p className="tiny" style={{ margin: 0 }}>
              Every record here is filed under this ID, and the database refuses to return a row to
              anyone else. No other account can see your clients, quotes or figures.
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

      <div className="section-title">Backup</div>
      <div className="card pad stack-sm">
        <p className="muted" style={{ margin: 0 }}>
          Everything the tracker holds — clients, jobs, quotes, payments, time, expenses and
          calendar — in one file you keep. Worth doing before any big change.
        </p>
        <div className="summary-line" style={{ padding: 0 }}>
          <span className="muted">Currently holding</span>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{describe(summarise(data))}</span>
        </div>
        <button className="btn" onClick={() => exportBackup(data)}>
          ⬇ Export a backup file
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆ Restore from a backup file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onRestoreFile(e.target.files?.[0])}
        />
        {notice && (
          <div className={`callout ${notice.kind === 'ok' ? 'ok' : 'warn'}`} style={{ margin: 0 }}>
            {notice.text}
          </div>
        )}
        <p className="tiny" style={{ margin: 0 }}>
          Restoring replaces everything currently in the app. You'll be shown both sets of numbers
          and asked to confirm first.
        </p>
      </div>

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
