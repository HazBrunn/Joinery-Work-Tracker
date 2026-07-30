import { useRef, useState } from 'react';
import { Screen } from '../components/Screen';
import { Field, Sheet } from '../components/ui';
import { DragContainer, DragHandle, DragRow, useDragList } from '../components/dragList';
import { useData } from '../store/DataContext';
import { jobCategoriesOf, THEMES } from '../types';
import { gbp2 } from '../lib/format';
import { describe, exportBackup, parseBackup, summarise } from '../lib/backup';
import type { Account } from '../App';

interface Props {
  onSignOut?: () => Promise<void>;
  authUser: Account | null;
}

export function SettingsScreen({ onSignOut, authUser }: Props) {
  const { data, setData, updateSettings, backendName, loadDemo, clearAll } = useData();
  const s = data.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {THEMES.map((t) => {
              const on = s.theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id })}
                  aria-pressed={on}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)', textAlign: 'left', minWidth: 0,
                    border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    background: 'var(--surface-2)', color: 'var(--text)',
                  }}
                >
                  <span style={{ display: 'flex', flex: '0 0 auto' }}>
                    {t.swatch.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          width: 16, height: 16, borderRadius: '50%', background: c,
                          marginLeft: i ? -5 : 0, border: '1.5px solid var(--surface)',
                        }}
                      />
                    ))}
                  </span>
                  <span className="grow" style={{ fontWeight: on ? 700 : 500, fontSize: 14 }}>
                    {t.label}
                  </span>
                  {t.dark && <span className="tiny">🌙</span>}
                </button>
              );
            })}
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
        <div className="divider" />
        <div className="summary-line" style={{ padding: 0 }}>
          <span className="muted">Job categories</span>
          <button className="btn sm" onClick={() => setCatsOpen(true)}>
            {jobCategoriesOf(s).length} · Edit
          </button>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          What kinds of work you take on. Used on every job, and to break down effective £/day by category.
        </p>
      </div>

      {catsOpen && <JobCategoriesSheet onClose={() => setCatsOpen(false)} />}

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

// ── Job categories ───────────────────────────────────────────────────────────
// Renaming carries the jobs with it: a category is only a label, and the jobs
// wearing it did not change. Deleting deliberately does not — it leaves the
// jobs where they are and simply stops offering the name, because silently
// re-filing someone's finished kitchen as "Other" is not a tidy-up.
function JobCategoriesSheet({ onClose }: { onClose: () => void }) {
  const { data, update, updateSettings } = useData();
  const categories = jobCategoriesOf(data.settings);
  const [adding, setAdding] = useState('');
  const dl = useDragList(categories, (next) => updateSettings({ jobCategories: next }));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const inUse = (name: string) => data.jobs.filter((j) => j.category === name).length;

  const add = () => {
    const n = adding.trim();
    if (!n || categories.includes(n)) return;
    updateSettings({ jobCategories: [...categories, n] });
    setAdding('');
  };
  const rename = (from: string) => {
    const to = draft.trim();
    setEditing(null);
    if (!to || to === from || categories.includes(to)) return;
    update((d) => {
      d.settings = { ...d.settings, jobCategories: categories.map((c) => (c === from ? to : c)) };
      d.jobs = d.jobs.map((j) => (j.category === from ? { ...j, category: to } : j));
    });
  };
  const remove = (name: string) => updateSettings({ jobCategories: categories.filter((c) => c !== name) });

  return (
    <Sheet title="Job categories" onClose={onClose}>
      <p className="tiny" style={{ marginTop: 0 }}>
        Drag the handle to set the order they appear in on a job.
      </p>
      <DragContainer>
        <div className="stack-sm">
          {categories.map((c, i) => {
            const used = inUse(c);
            return (
              <DragRow key={c} dl={dl} index={i}>
              <div className="card pad" style={{ background: 'var(--surface-2)' }}>
              {editing === c ? (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(c);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <button className="btn sm primary" onClick={() => rename(c)}>
                    Save
                  </button>
                </div>
              ) : (
                <div className="row between" style={{ gap: 8 }}>
                  <DragHandle dl={dl} index={i} />
                  <span className="grow">
                    <div style={{ fontWeight: 600 }}>{c}</div>
                    <div className="tiny">{used ? `${used} job${used === 1 ? '' : 's'}` : 'Not used yet'}</div>
                  </span>
                  <button
                    className="btn-icon"
                    title="Rename"
                    onClick={() => {
                      setEditing(c);
                      setDraft(c);
                    }}
                  >
                    ✎
                  </button>
                  <button className="btn-icon" title="Remove from the list" onClick={() => remove(c)}>
                    ✕
                  </button>
                </div>
              )}
              </div>
              </DragRow>
            );
          })}
        </div>
      </DragContainer>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <input
          className="input"
          placeholder="New category"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn sm primary" onClick={add} disabled={!adding.trim()}>
          Add
        </button>
      </div>
      <p className="tiny" style={{ marginTop: 10 }}>
        Renaming updates every job using it. Removing one leaves those jobs alone — they keep the category
        they have, it just stops being offered on new work.
      </p>
    </Sheet>
  );
}
