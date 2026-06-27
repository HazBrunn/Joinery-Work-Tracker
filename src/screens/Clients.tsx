import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { EmptyState, Field, Sheet } from '../components/ui';
import { useData } from '../store/DataContext';
import { Client, LEAD_SOURCES } from '../types';
import { uid } from '../lib/id';
import { jobsForClient } from '../lib/calc';

export function Clients() {
  const { data } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...data.clients].sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (!q) return list;
    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
  }, [data.clients, search]);

  return (
    <Screen
      title="Clients"
      action={
        <button className="header-action" onClick={() => setAdding(true)}>
          + New
        </button>
      }
    >
      <input
        className="input"
        placeholder="Search name, address, phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          emoji="👥"
          title={data.clients.length === 0 ? 'No clients yet' : 'No matches'}
          hint={data.clients.length === 0 ? 'Add a client, then create jobs for them.' : undefined}
          action={
            data.clients.length === 0 ? (
              <button className="btn primary" onClick={() => setAdding(true)}>
                + Add your first client
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="list-grid">
          {filtered.map((c) => {
            const jobs = jobsForClient(data, c.id);
            return (
              <button key={c.id} className="list-row" onClick={() => navigate(`/clients/${c.id}`)}>
                <span className="avatar">{initials(c.fullName)}</span>
                <span className="grow">
                  <div className="title">{c.fullName}</div>
                  <div className="subtitle">
                    {c.address || 'No address'} · {jobs.length} job{jobs.length === 1 ? '' : 's'}
                  </div>
                </span>
                <span className="chev">›</span>
              </button>
            );
          })}
        </div>
      )}

      {adding && (
        <ClientForm
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            setAdding(false);
            navigate(`/clients/${id}`);
          }}
        />
      )}
    </Screen>
  );
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export function ClientForm({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Client;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { update } = useData();
  const [form, setForm] = useState<Client>(
    existing ?? {
      id: uid(),
      fullName: '',
      address: '',
      phone: '',
      email: '',
      source: LEAD_SOURCES[0],
      notes: '',
      createdAt: new Date().toISOString(),
    },
  );

  const set = (patch: Partial<Client>) => setForm((f) => ({ ...f, ...patch }));

  const save = () => {
    if (!form.fullName.trim()) return;
    update((draft) => {
      const idx = draft.clients.findIndex((c) => c.id === form.id);
      if (idx >= 0) draft.clients[idx] = form;
      else draft.clients.push(form);
    });
    onSaved?.(form.id);
    onClose();
  };

  return (
    <Sheet title={existing ? 'Edit client' : 'New client'} onClose={onClose}>
      <div className="stack">
        <Field label="Full name">
          <input
            className="input"
            value={form.fullName}
            autoFocus
            onChange={(e) => set({ fullName: e.target.value })}
            placeholder="e.g. Sarah Whitfield"
          />
        </Field>
        <Field label="Address">
          <textarea
            className="textarea"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            placeholder="Site / home address"
          />
        </Field>
        <div className="field-row">
          <Field label="Phone">
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Source">
          <select className="select" value={form.source} onChange={(e) => set({ source: e.target.value })}>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            className="textarea"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Access details, preferences…"
          />
        </Field>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={!form.fullName.trim()}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
