import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { EmptyState, StatusBadge } from '../components/ui';
import { ClientForm, initials } from './Clients';
import { useData } from '../store/DataContext';
import { jobsForClient } from '../lib/calc';
import { fmtDate } from '../lib/format';
import { NewJobForm } from './Jobs';

export function ClientDetail() {
  const { id } = useParams();
  const { data, update } = useData();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [addingJob, setAddingJob] = useState(false);

  const client = data.clients.find((c) => c.id === id);
  if (!client) {
    return (
      <Screen title="Client" back>
        <EmptyState emoji="🤷" title="Client not found" />
      </Screen>
    );
  }
  const jobs = jobsForClient(data, client.id);

  const remove = () => {
    if (jobs.length > 0) {
      alert('This client has linked jobs. Reassign or delete those jobs first.');
      return;
    }
    if (!confirm(`Delete ${client.fullName}?`)) return;
    update((draft) => {
      draft.clients = draft.clients.filter((c) => c.id !== client.id);
    });
    navigate('/clients');
  };

  return (
    <Screen
      title={client.fullName}
      back
      action={
        <button className="header-action" onClick={() => setEditing(true)}>
          Edit
        </button>
      }
    >
      <div className="card pad stack">
        <div className="row">
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 20 }}>
            {initials(client.fullName)}
          </span>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 18 }}>{client.fullName}</div>
            <div className="tiny">Client since {fmtDate(client.createdAt)}</div>
          </div>
        </div>
        <div className="divider" />
        <InfoLine label="Address" value={client.address} />
        <InfoLine
          label="Phone"
          value={client.phone}
          href={client.phone ? `tel:${client.phone.replace(/\s/g, '')}` : undefined}
        />
        <InfoLine
          label="Email"
          value={client.email}
          href={client.email ? `mailto:${client.email}` : undefined}
        />
        <InfoLine label="Source" value={client.source} />
        {client.notes && <InfoLine label="Notes" value={client.notes} />}
      </div>

      <div className="row between" style={{ margin: '20px 4px 8px' }}>
        <div className="section-title" style={{ margin: 0 }}>
          Linked jobs ({jobs.length})
        </div>
        <button className="btn sm" onClick={() => setAddingJob(true)}>
          + Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="muted" style={{ padding: '0 4px' }}>
          No jobs for this client yet.
        </p>
      ) : (
        <div className="stack">
          {jobs.map((j) => (
            <button key={j.id} className="list-row" onClick={() => navigate(`/jobs/${j.id}`)}>
              <span className="grow">
                <div className="title">{j.title}</div>
                <div className="subtitle">
                  {j.category} · added {fmtDate(j.dateAdded)}
                </div>
              </span>
              <StatusBadge status={j.status} />
            </button>
          ))}
        </div>
      )}

      <button className="btn danger block" style={{ marginTop: 24 }} onClick={remove}>
        Delete client
      </button>

      {editing && <ClientForm existing={client} onClose={() => setEditing(false)} />}
      {addingJob && (
        <NewJobForm
          presetClientId={client.id}
          onClose={() => setAddingJob(false)}
          onSaved={(jid) => {
            setAddingJob(false);
            navigate(`/jobs/${jid}`);
          }}
        />
      )}
    </Screen>
  );
}

function InfoLine({ label, value, href }: { label: string; value: string; href?: string }) {
  if (!value) return null;
  return (
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <span className="tiny" style={{ minWidth: 70 }}>
        {label}
      </span>
      <span className="grow right" style={{ whiteSpace: 'pre-wrap' }}>
        {href ? <a href={href}>{value}</a> : value}
      </span>
    </div>
  );
}
