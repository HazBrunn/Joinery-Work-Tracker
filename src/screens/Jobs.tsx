import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { EmptyState, Field, Sheet, StatusBadge } from '../components/ui';
import { useData } from '../store/DataContext';
import {
  Job,
  JobStatus,
  JOB_CATEGORIES,
  JOB_STATUSES,
  LEAD_SOURCES,
  newQuote,
} from '../types';
import { uid } from '../lib/id';
import { clientById, outstandingTotal, receivedTotal } from '../lib/calc';
import { gbp, fmtDate } from '../lib/format';

type ViewMode = 'board' | 'list';

export function Jobs() {
  const { data } = useData();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('board');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.jobs
      .filter((j) => (statusFilter === 'all' ? true : j.status === statusFilter))
      .filter((j) => (categoryFilter === 'all' ? true : j.category === categoryFilter))
      .filter((j) => (q ? j.title.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1));
  }, [data.jobs, statusFilter, categoryFilter, search]);

  const categories = useMemo(() => {
    const used = new Set(data.jobs.map((j) => j.category));
    return JOB_CATEGORIES.filter((c) => used.has(c));
  }, [data.jobs]);

  return (
    <Screen
      title="Jobs"
      action={
        <button className="header-action" onClick={() => setAdding(true)}>
          + New
        </button>
      }
    >
      <div className="segmented" style={{ marginBottom: 12 }}>
        <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
          Board
        </button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          List
        </button>
      </div>

      {view === 'list' && (
        <input
          className="input"
          placeholder="Search jobs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />
      )}

      {categories.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <button
            className={`chip ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${categoryFilter === c ? 'active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {data.jobs.length === 0 ? (
        <EmptyState
          emoji="🔨"
          title="No jobs yet"
          hint="Create your first job to start tracking the work."
          action={
            <button className="btn primary" onClick={() => setAdding(true)}>
              + Add a job
            </button>
          }
        />
      ) : view === 'board' ? (
        <BoardView jobs={filtered} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
      ) : (
        <ListView jobs={filtered} />
      )}

      {adding && (
        <NewJobForm
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            setAdding(false);
            navigate(`/jobs/${id}`);
          }}
        />
      )}
    </Screen>
  );
}

function BoardView({
  jobs,
  statusFilter,
  setStatusFilter,
}: {
  jobs: Job[];
  statusFilter: JobStatus | 'all';
  setStatusFilter: (s: JobStatus | 'all') => void;
}) {
  const navigate = useNavigate();
  const { data } = useData();
  // Group jobs by status, keep pipeline order.
  const groups = JOB_STATUSES.map((s) => ({
    status: s,
    jobs: jobs.filter((j) => j.status === s.value),
  })).filter((g) => g.jobs.length > 0 && (statusFilter === 'all' || statusFilter === g.status.value));

  return (
    <>
      <div className="chips" style={{ marginBottom: 14 }}>
        <button
          className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All stages
        </button>
        {JOB_STATUSES.map((s) => {
          const count = jobs.filter((j) => j.status === s.value).length;
          if (count === 0) return null;
          return (
            <button
              key={s.value}
              className={`chip ${statusFilter === s.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.icon} {s.label} {count}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <p className="muted" style={{ padding: '8px 4px' }}>
          No jobs match this filter.
        </p>
      ) : (
        <div className="board">
          {groups.map((g) => (
            <div className="board-col" key={g.status.value}>
              <div className="section-title">
                {g.status.icon} {g.status.label} · {g.jobs.length}
              </div>
              <div className="stack">
                {g.jobs.map((j) => (
                  <JobCard key={j.id} job={j} onOpen={() => navigate(`/jobs/${j.id}`)} clientName={clientById(data, j.clientId)?.fullName} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ListView({ jobs }: { jobs: Job[] }) {
  const navigate = useNavigate();
  const { data } = useData();
  if (jobs.length === 0)
    return (
      <p className="muted" style={{ padding: '8px 4px' }}>
        No jobs match this filter.
      </p>
    );
  return (
    <div className="list-grid">
      {jobs.map((j) => (
        <JobCard key={j.id} job={j} onOpen={() => navigate(`/jobs/${j.id}`)} clientName={clientById(data, j.clientId)?.fullName} showStatus />
      ))}
    </div>
  );
}

function JobCard({
  job,
  onOpen,
  clientName,
  showStatus,
}: {
  job: Job;
  onOpen: () => void;
  clientName?: string;
  showStatus?: boolean;
}) {
  const outstanding = outstandingTotal(job);
  const received = receivedTotal(job);
  return (
    <button className="list-row" onClick={onOpen}>
      <span className="grow">
        <div className="row between">
          <div className="title">{job.title}</div>
        </div>
        <div className="subtitle">
          {clientName ? `${clientName} · ` : ''}
          {job.category}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          {showStatus && <StatusBadge status={job.status} />}
          {received > 0 && <span className="pill">{gbp(received)} in</span>}
          {outstanding > 0 && (
            <span className="pill" style={{ color: 'var(--amber)' }}>
              {gbp(outstanding)} due
            </span>
          )}
          <span className="tiny">{fmtDate(job.dateAdded)}</span>
        </div>
      </span>
    </button>
  );
}

// ── New job form ─────────────────────────────────────────────────────────────
export function NewJobForm({
  presetClientId,
  onClose,
  onSaved,
}: {
  presetClientId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { data, update } = useData();
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string>(presetClientId ?? data.clients[0]?.id ?? '');
  const [category, setCategory] = useState(JOB_CATEGORIES[0]);
  const [leadSource, setLeadSource] = useState(LEAD_SOURCES[0]);
  const [status, setStatus] = useState<JobStatus>('lead_in');

  const save = () => {
    if (!title.trim()) return;
    const job: Job = {
      id: uid(),
      title: title.trim(),
      clientId: clientId || null,
      category,
      status,
      leadSource,
      dateAdded: new Date().toISOString(),
      measurements: [],
      quote: newQuote(data.settings.defaultDayRate),
      stagePayments: [],
      agreedPrice: null,
      timeEntries: [],
      photos: [],
      tasks: [],
      notes: '',
    };
    update((draft) => {
      draft.jobs.push(job);
    });
    onSaved(job.id);
  };

  return (
    <Sheet title="New job" onClose={onClose}>
      <div className="stack">
        <Field label="Job title / short description">
          <input
            className="input"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Master bedroom fitted wardrobes"
          />
        </Field>
        <Field label="Client">
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— No client yet —</option>
            {data.clients
              .slice()
              .sort((a, b) => a.fullName.localeCompare(b.fullName))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
          </select>
        </Field>
        <div className="field-row">
          <Field label="Category">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {JOB_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Lead source">
            <select className="select" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Starting status">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
            {JOB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={!title.trim()}>
          Create job
        </button>
      </div>
    </Sheet>
  );
}
