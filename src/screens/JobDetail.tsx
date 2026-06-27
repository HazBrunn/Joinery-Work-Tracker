import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Collapsible, EmptyState, Field, PriorityDot, Sheet, StatusBadge } from '../components/ui';
import { useData } from '../store/DataContext';
import {
  Job,
  JobStatus,
  JobTask,
  JOB_CATEGORIES,
  JOB_STATUSES,
  Priority,
  PRIORITIES,
  PhotoGroup,
  TaskCategory,
  TASK_CATEGORIES,
} from '../types';
import { uid } from '../lib/id';
import {
  clientById,
  grossProfit,
  hourlyRate,
  jobExpenses,
  jobExpensesTotal,
  labourEstimate,
  materialsTotal,
  outstandingTotal,
  receivedTotal,
  stagePaymentsMismatch,
  stagePaymentsTotal,
  suggestedQuote,
  totalHours,
} from '../lib/calc';
import { gbp, gbp2, hoursLabel, fmtDate, fmtDateTime, todayISO } from '../lib/format';

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, update } = useData();
  const [statusOpen, setStatusOpen] = useState(false);

  const job = data.jobs.find((j) => j.id === id);
  if (!job) {
    return (
      <Screen title="Job" back>
        <EmptyState emoji="🤷" title="Job not found" />
      </Screen>
    );
  }

  const hpd = data.settings.workingHoursPerDay || 8;
  const client = clientById(data, job.clientId);

  const updateJob = (mutator: (j: Job) => void) => {
    update((draft) => {
      const idx = draft.jobs.findIndex((j) => j.id === job.id);
      if (idx < 0) return;
      const clone: Job = structuredClone(draft.jobs[idx]);
      mutator(clone);
      draft.jobs[idx] = clone;
    });
  };

  const setStatus = (status: JobStatus) => {
    updateJob((j) => {
      j.status = status;
    });
    setStatusOpen(false);
  };

  const duplicate = () => {
    const copy: Job = {
      ...structuredClone(job),
      id: uid(),
      title: `${job.title} (copy)`,
      status: 'lead_in',
      dateAdded: new Date().toISOString(),
      // carry category, materials list and structure; reset progress/money
      stagePayments: [],
      agreedPrice: null,
      timeEntries: [],
      photos: [],
      tasks: [],
      rejectionReason: undefined,
      visitDate: undefined,
      measurements: job.measurements.map((m) => ({ ...m, id: uid() })),
      quote: {
        ...structuredClone(job.quote),
        materials: job.quote.materials.map((m) => ({ ...m, id: uid() })),
      },
    };
    update((draft) => {
      draft.jobs.push(copy);
    });
    navigate(`/jobs/${copy.id}`);
  };

  const deleteJob = () => {
    if (!confirm(`Delete "${job.title}"? This also unlinks its expenses.`)) return;
    update((draft) => {
      draft.jobs = draft.jobs.filter((j) => j.id !== job.id);
      draft.expenses = draft.expenses.map((e) =>
        e.linkedJobId === job.id ? { ...e, linkedJobId: null } : e,
      );
      draft.calendarBlocks = draft.calendarBlocks.filter((b) => b.jobId !== job.id);
    });
    navigate('/jobs');
  };

  return (
    <Screen title={job.title} back action={<button className="header-action" onClick={duplicate}>⧉ Duplicate</button>}>
      {/* Header card */}
      <div className="card pad stack-sm">
        <div className="row between">
          <StatusBadge status={job.status} onClick={() => setStatusOpen(true)} />
          <span className="tiny">Added {fmtDate(job.dateAdded)}</span>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{job.title}</div>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="pill">{job.category}</span>
          <span className="pill">via {job.leadSource}</span>
        </div>
        {client ? (
          <Link to={`/clients/${client.id}`} className="row between" style={{ marginTop: 4 }}>
            <span className="grow">
              <div className="tiny">Client</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{client.fullName}</div>
            </span>
            <span className="chev" style={{ color: 'var(--text-3)' }}>›</span>
          </Link>
        ) : (
          <div className="tiny">No client linked</div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button className="btn sm ghost grow" onClick={() => setStatusOpen(true)}>
            Change status
          </button>
          <EditHeaderButton job={job} updateJob={updateJob} />
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="job-sections">
        <MeasurementsSection job={job} updateJob={updateJob} />
        <QuoteSection job={job} updateJob={updateJob} hpd={hpd} />
        <StagePaymentsSection job={job} updateJob={updateJob} />
        <AgreedPriceSection job={job} updateJob={updateJob} />
        <TimeSection job={job} updateJob={updateJob} hpd={hpd} />
        <PhotosSection job={job} updateJob={updateJob} />
        <TasksSection job={job} updateJob={updateJob} />
        <FinalActualsSection job={job} />
        {job.status === 'rejected' && <RejectionSection job={job} updateJob={updateJob} />}
        <NotesSection job={job} updateJob={updateJob} />
      </div>

      <button className="btn danger block" style={{ marginTop: 20 }} onClick={deleteJob}>
        Delete job
      </button>

      {statusOpen && (
        <Sheet title="Change status" onClose={() => setStatusOpen(false)}>
          <div className="stack-sm">
            {JOB_STATUSES.map((s) => (
              <button
                key={s.value}
                className="list-row"
                onClick={() => setStatus(s.value)}
                style={{ outline: job.status === s.value ? '2px solid var(--accent)' : undefined }}
              >
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <span className="grow">
                  <div className="title">{s.label}</div>
                </span>
                {job.status === s.value && <span>✓</span>}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Screen>
  );
}

// ── Edit header (title/category/leadsource/visit) ────────────────────────────
function EditHeaderButton({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(job.title);
  const [category, setCategory] = useState(job.category);
  const [visit, setVisit] = useState(job.visitDate ? job.visitDate.slice(0, 16) : '');

  const save = () => {
    updateJob((j) => {
      j.title = title.trim() || j.title;
      j.category = category;
      j.visitDate = visit ? new Date(visit).toISOString() : undefined;
    });
    setOpen(false);
  };
  return (
    <>
      <button className="btn sm ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <Sheet title="Edit job" onClose={() => setOpen(false)}>
          <div className="stack">
            <Field label="Title">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Category">
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {JOB_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Quote visit (date & time)">
              <input className="input" type="datetime-local" value={visit} onChange={(e) => setVisit(e.target.value)} />
            </Field>
          </div>
          <div className="sheet-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ── Measurements ─────────────────────────────────────────────────────────────
function MeasurementsSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const add = () => {
    if (!label.trim()) return;
    updateJob((j) => {
      j.measurements = [...j.measurements, { id: uid(), label: label.trim(), value: value.trim() }];
    });
    setLabel('');
    setValue('');
  };
  const remove = (id: string) =>
    updateJob((j) => {
      j.measurements = j.measurements.filter((m) => m.id !== id);
    });
  return (
    <Collapsible icon="📐" title="Measurements" subtitle={job.measurements.length || ''}>
      <div className="stack-sm">
        {job.measurements.map((m) => (
          <div key={m.id} className="line-item">
            <span className="grow">{m.label}</span>
            <span style={{ fontWeight: 700 }}>{m.value}</span>
            <button className="btn-icon" onClick={() => remove(m.id)}>
              ✕
            </button>
          </div>
        ))}
        {job.measurements.length === 0 && <p className="muted">No measurements yet.</p>}
        <div className="field-row" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Label (e.g. Alcove width)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="input" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 120 }} />
        </div>
        <button className="btn sm" onClick={add}>
          + Add measurement
        </button>
      </div>
    </Collapsible>
  );
}

// ── Quote breakdown ──────────────────────────────────────────────────────────
function QuoteSection({ job, updateJob, hpd }: { job: Job; updateJob: (m: (j: Job) => void) => void; hpd: number }) {
  const mat = materialsTotal(job);
  const lab = labourEstimate(job, hpd);
  const total = suggestedQuote(job, hpd);

  const addMaterial = () =>
    updateJob((j) => {
      j.quote.materials = [...j.quote.materials, { id: uid(), item: '', quantity: 1, unitCost: 0 }];
    });
  const setMaterial = (id: string, patch: Partial<{ item: string; quantity: number; unitCost: number }>) =>
    updateJob((j) => {
      j.quote.materials = j.quote.materials.map((m) => (m.id === id ? { ...m, ...patch } : m));
    });
  const removeMaterial = (id: string) =>
    updateJob((j) => {
      j.quote.materials = j.quote.materials.filter((m) => m.id !== id);
    });

  return (
    <Collapsible icon="💰" title="Quote Breakdown" subtitle={total > 0 ? gbp(total) : ''}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Materials
      </div>
      <div className="stack-sm">
        {job.quote.materials.map((m) => (
          <div key={m.id} className="card pad" style={{ background: 'var(--surface-2)' }}>
            <input
              className="input"
              placeholder="Item"
              value={m.item}
              onChange={(e) => setMaterial(m.id, { item: e.target.value })}
              style={{ marginBottom: 8 }}
            />
            <div className="row" style={{ gap: 8 }}>
              <Field label="Qty">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={m.quantity}
                  onChange={(e) => setMaterial(m.id, { quantity: +e.target.value })}
                />
              </Field>
              <Field label="Unit £">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={m.unitCost}
                  onChange={(e) => setMaterial(m.id, { unitCost: +e.target.value })}
                />
              </Field>
              <div style={{ alignSelf: 'flex-end', minWidth: 70 }} className="right">
                <div className="tiny">Total</div>
                <div style={{ fontWeight: 700 }}>{gbp(m.quantity * m.unitCost)}</div>
              </div>
              <button className="btn-icon" style={{ alignSelf: 'flex-end' }} onClick={() => removeMaterial(m.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        <button className="btn sm" onClick={addMaterial}>
          + Add material row
        </button>
      </div>

      <div className="section-title">Labour estimate</div>
      <div className="field-row">
        <Field label="Day rate (£)">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={job.quote.dayRate}
            onChange={(e) =>
              updateJob((j) => {
                j.quote.dayRate = +e.target.value;
              })
            }
          />
        </Field>
        <Field label="Est. days">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={+(job.quote.estimatedHours / hpd).toFixed(2) || ''}
            onChange={(e) =>
              updateJob((j) => {
                j.quote.estimatedHours = +e.target.value * hpd;
              })
            }
          />
        </Field>
        <Field label="Est. hours">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={job.quote.estimatedHours || ''}
            onChange={(e) =>
              updateJob((j) => {
                j.quote.estimatedHours = +e.target.value;
              })
            }
          />
        </Field>
      </div>
      <p className="tiny" style={{ marginTop: 6 }}>
        £{job.quote.dayRate}/day = {gbp2(hourlyRate(job.quote.dayRate, hpd))}/hr · days assume {hpd}h
      </p>

      <div className="divider" style={{ margin: '12px 0' }} />
      <div className="summary-line">
        <span className="muted">Estimated materials</span>
        <span className="mono">{gbp(mat)}</span>
      </div>
      <div className="summary-line">
        <span className="muted">Estimated labour</span>
        <span className="mono">{gbp(lab)}</span>
      </div>
      <div className="summary-line total">
        <span>Suggested quote price</span>
        <span className="mono">{gbp(total)}</span>
      </div>
    </Collapsible>
  );
}

// ── Stage payments ───────────────────────────────────────────────────────────
function StagePaymentsSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  const total = stagePaymentsTotal(job);
  const mismatch = stagePaymentsMismatch(job);

  const add = () =>
    updateJob((j) => {
      j.stagePayments = [...j.stagePayments, { id: uid(), milestone: '', amount: 0, received: false }];
    });
  const setStage = (id: string, patch: Partial<{ milestone: string; amount: number }>) =>
    updateJob((j) => {
      j.stagePayments = j.stagePayments.map((p) => (p.id === id ? { ...p, ...patch } : p));
    });
  const toggleReceived = (id: string) =>
    updateJob((j) => {
      j.stagePayments = j.stagePayments.map((p) =>
        p.id === id
          ? { ...p, received: !p.received, receivedDate: !p.received ? todayISO() : undefined }
          : p,
      );
    });
  const remove = (id: string) =>
    updateJob((j) => {
      j.stagePayments = j.stagePayments.filter((p) => p.id !== id);
    });

  return (
    <Collapsible icon="💷" title="Stage Payments" subtitle={job.stagePayments.length ? gbp(total) : ''}>
      <p className="muted" style={{ marginTop: 0 }}>
        Break the price into milestone payments. Tick each as it lands.
      </p>
      <div className="stack-sm">
        {job.stagePayments.map((p) => (
          <div key={p.id} className="card pad" style={{ background: 'var(--surface-2)' }}>
            <input
              className="input"
              placeholder="Milestone (e.g. Deposit on acceptance)"
              value={p.milestone}
              onChange={(e) => setStage(p.id, { milestone: e.target.value })}
              style={{ marginBottom: 8 }}
            />
            <div className="row" style={{ gap: 8 }}>
              <Field label="Amount £">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={p.amount || ''}
                  onChange={(e) => setStage(p.id, { amount: +e.target.value })}
                />
              </Field>
              <button
                className={`btn sm ${p.received ? 'amber' : 'ghost'}`}
                style={{ alignSelf: 'flex-end' }}
                onClick={() => toggleReceived(p.id)}
              >
                {p.received ? `✓ Received ${p.receivedDate ? fmtDate(p.receivedDate) : ''}` : 'Mark received'}
              </button>
              <button className="btn-icon" style={{ alignSelf: 'flex-end' }} onClick={() => remove(p.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        <button className="btn sm" onClick={add}>
          + Add stage payment
        </button>
      </div>

      {job.stagePayments.length > 0 && (
        <>
          <div className="summary-line total" style={{ marginTop: 12 }}>
            <span>Stages total</span>
            <span className="mono">{gbp(total)}</span>
          </div>
          {mismatch && (
            <div className="callout warn" style={{ marginTop: 8 }}>
              ⚠️ Stages total {gbp(total)} but the agreed price is {gbp(job.agreedPrice!)}. Adjust the stages
              or the agreed figure so they reconcile.
            </div>
          )}
          {!mismatch && job.agreedPrice != null && (
            <div className="callout ok" style={{ marginTop: 8 }}>
              ✓ Stages reconcile with the agreed price.
            </div>
          )}
        </>
      )}
    </Collapsible>
  );
}

// ── Agreed price ─────────────────────────────────────────────────────────────
function AgreedPriceSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  const suggested = suggestedQuote(job, 8);
  const diff = job.agreedPrice != null ? job.agreedPrice - suggested : null;
  return (
    <Collapsible icon="🤝" title="Agreed Price" subtitle={job.agreedPrice != null ? gbp(job.agreedPrice) : ''}>
      <p className="muted" style={{ marginTop: 0 }}>
        What the client actually agreed to — separate from the quoted figure.
      </p>
      <Field label="Agreed price (£)">
        <input
          className="input"
          type="number"
          inputMode="decimal"
          value={job.agreedPrice ?? ''}
          placeholder="Not set"
          onChange={(e) =>
            updateJob((j) => {
              j.agreedPrice = e.target.value === '' ? null : +e.target.value;
            })
          }
        />
      </Field>
      {diff != null && suggested > 0 && (
        <p className="tiny" style={{ marginTop: 8 }}>
          {diff < 0 ? (
            <span className="text-amber">Negotiated down {gbp(Math.abs(diff))} from the suggested quote.</span>
          ) : diff > 0 ? (
            <span className="text-green">{gbp(diff)} above the suggested quote.</span>
          ) : (
            <span>Matches the suggested quote exactly.</span>
          )}
        </p>
      )}
    </Collapsible>
  );
}

// ── Time tracking ────────────────────────────────────────────────────────────
function TimeSection({ job, updateJob, hpd }: { job: Job; updateJob: (m: (j: Job) => void) => void; hpd: number }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');

  const hours = totalHours(job);

  const add = () => {
    const n = parseFloat(amount);
    if (!desc.trim() || !n) return;
    const h = unit === 'days' ? n * hpd : n;
    updateJob((j) => {
      j.timeEntries = [...j.timeEntries, { id: uid(), description: desc.trim(), hours: h }];
    });
    setDesc('');
    setAmount('');
  };
  const remove = (id: string) =>
    updateJob((j) => {
      j.timeEntries = j.timeEntries.filter((t) => t.id !== id);
    });

  const received = receivedTotal(job);
  const effHourly = hours ? received / hours : null;
  const effDaily = effHourly != null ? effHourly * hpd : null;

  return (
    <Collapsible icon="⏱️" title="Time Tracking" subtitle={hours ? hoursLabel(hours, hpd) : ''}>
      <div className="stack-sm">
        {job.timeEntries.map((t) => (
          <div key={t.id} className="line-item">
            <span className="grow">{t.description}</span>
            <span style={{ fontWeight: 700 }}>{hoursLabel(t.hours, hpd)}</span>
            <button className="btn-icon" onClick={() => remove(t.id)}>
              ✕
            </button>
          </div>
        ))}
        {job.timeEntries.length === 0 && <p className="muted">No time logged yet.</p>}
        <input
          className="input"
          placeholder="What did you do? (e.g. On-site install)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{ marginTop: 8 }}
        />
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="segmented" style={{ width: 160 }}>
            <button className={unit === 'hours' ? 'active' : ''} onClick={() => setUnit('hours')}>
              Hours
            </button>
            <button className={unit === 'days' ? 'active' : ''} onClick={() => setUnit('days')}>
              Days
            </button>
          </div>
        </div>
        <button className="btn sm" onClick={add}>
          + Log time
        </button>
      </div>

      {hours > 0 && (
        <>
          <div className="divider" style={{ margin: '12px 0' }} />
          <div className="summary-line">
            <span className="muted">Total time</span>
            <span className="mono">
              {hoursLabel(hours, hpd)} ({hours}h)
            </span>
          </div>
          {received > 0 && (
            <>
              <div className="summary-line">
                <span className="muted">Effective £/hour</span>
                <span className="mono text-green">{gbp2(effHourly!)}</span>
              </div>
              <div className="summary-line">
                <span className="muted">Effective £/day</span>
                <span className="mono text-green">{gbp(effDaily!)}</span>
              </div>
              <p className="tiny">Based on income received so far ÷ hours logged.</p>
            </>
          )}
        </>
      )}
    </Collapsible>
  );
}

// ── Photos ───────────────────────────────────────────────────────────────────
const PHOTO_GROUPS: { value: PhotoGroup; label: string }[] = [
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after', label: 'After' },
];

function PhotosSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  const { uploadImage } = useData();
  const [uploading, setUploading] = useState(0);

  const onPick = async (group: PhotoGroup, files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        // Local backend returns a data URL; Firebase uploads to Storage and
        // returns the download URL. Either way we store a URL string.
        const url = await uploadImage(file, job.id);
        updateJob((j) => {
          j.photos = [...j.photos, { id: uid(), group, dataUrl: url }];
        });
      } catch (err) {
        console.error('Photo upload failed', err);
        alert('Sorry — that photo failed to upload. Please try again.');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const remove = (id: string) =>
    updateJob((j) => {
      j.photos = j.photos.filter((p) => p.id !== id);
    });

  return (
    <Collapsible icon="📷" title="Photos" subtitle={job.photos.length || ''}>
      {PHOTO_GROUPS.map((g) => {
        const photos = job.photos.filter((p) => p.group === g.value);
        return (
          <div key={g.value} style={{ marginBottom: 14 }}>
            <div className="row between">
              <div className="section-title" style={{ margin: '6px 0' }}>
                {g.label}
              </div>
              <label className="btn sm ghost" style={{ cursor: 'pointer' }}>
                + Add
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => onPick(g.value, e.target.files)}
                />
              </label>
            </div>
            {photos.length === 0 ? (
              <p className="tiny" style={{ margin: 0 }}>
                No {g.label.toLowerCase()} photos.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {photos.map((p) => (
                  <div key={p.id} style={{ position: 'relative' }}>
                    <img
                      src={p.dataUrl}
                      alt=""
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }}
                    />
                    <button
                      className="btn-icon"
                      onClick={() => remove(p.id)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {uploading > 0 && (
        <p className="tiny">Uploading {uploading} photo{uploading === 1 ? '' : 's'}…</p>
      )}
      <p className="tiny">Photos sync to the cloud once Firebase is connected.</p>
    </Collapsible>
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────
function TasksSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  const [adding, setAdding] = useState(false);
  const open = job.tasks.filter((t) => !t.done);
  const done = job.tasks.filter((t) => t.done);

  const toggle = (id: string) =>
    updateJob((j) => {
      j.tasks = j.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined } : t,
      );
    });
  const remove = (id: string) =>
    updateJob((j) => {
      j.tasks = j.tasks.filter((t) => t.id !== id);
    });
  const addTask = (t: JobTask) =>
    updateJob((j) => {
      j.tasks = [...j.tasks, t];
    });

  return (
    <Collapsible icon="✅" title="Tasks" subtitle={open.length ? `${open.length} open` : ''}>
      <div className="stack-sm">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => toggle(t.id)} onRemove={() => remove(t.id)} />
        ))}
        {open.length === 0 && <p className="muted" style={{ margin: 0 }}>No open tasks.</p>}
        <button className="btn sm" onClick={() => setAdding(true)}>
          + Add task
        </button>
      </div>
      {done.length > 0 && (
        <>
          <div className="section-title">Done ({done.length})</div>
          <div className="stack-sm">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={() => toggle(t.id)} onRemove={() => remove(t.id)} />
            ))}
          </div>
        </>
      )}
      {adding && <TaskForm onClose={() => setAdding(false)} onAdd={addTask} />}
    </Collapsible>
  );
}

function TaskRow({ task, onToggle, onRemove }: { task: JobTask; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="line-item">
      <button className="btn-icon" onClick={onToggle} style={{ background: task.done ? 'var(--green)' : 'var(--pill)', color: task.done ? '#fff' : 'var(--text-3)' }}>
        {task.done ? '✓' : ''}
      </button>
      <PriorityDot priority={task.priority} />
      <span className="grow">
        <div className={task.done ? 'strike' : ''} style={{ fontWeight: 600 }}>
          {task.title}
        </div>
        <div className="tiny">
          {task.category}
          {task.deadline ? ` · ${fmtDateTime(task.deadline)}` : ''}
        </div>
      </span>
      <button className="btn-icon" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function TaskForm({ onClose, onAdd }: { onClose: () => void; onAdd: (t: JobTask) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(TASK_CATEGORIES[0]);
  const [priority, setPriority] = useState<Priority>('amber');
  const [deadline, setDeadline] = useState('');
  const save = () => {
    if (!title.trim()) return;
    onAdd({
      id: uid(),
      title: title.trim(),
      category,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      done: false,
    });
    onClose();
  };
  return (
    <Sheet title="New task" onClose={onClose}>
      <div className="stack">
        <Field label="Task">
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Order materials" />
        </Field>
        <Field label="Category">
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
            {TASK_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <div className="segmented">
            {PRIORITIES.map((p) => (
              <button key={p.value} className={priority === p.value ? 'active' : ''} onClick={() => setPriority(p.value)}>
                <span className="dot" style={{ background: p.color, display: 'inline-block', marginRight: 6 }} />
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Deadline">
          <input className="input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={!title.trim()}>
          Add task
        </button>
      </div>
    </Sheet>
  );
}

// ── Final actuals ────────────────────────────────────────────────────────────
function FinalActualsSection({ job }: { job: Job }) {
  const { data } = useData();
  const expenses = jobExpenses(data, job.id);
  const expTotal = jobExpensesTotal(data, job.id);
  const received = receivedTotal(job);
  const profit = grossProfit(data, job);
  return (
    <Collapsible icon="📂" title="Final Actuals" subtitle={received || expTotal ? gbp(profit) : ''}>
      <div className="section-title" style={{ marginTop: 0 }}>
        Expenses on this job
      </div>
      {expenses.length === 0 ? (
        <p className="muted">
          No expenses linked yet. Add them in Finances and link to this job.
        </p>
      ) : (
        <div className="stack-sm">
          {expenses.map((e) => (
            <div key={e.id} className="line-item">
              <span className="grow">
                <div style={{ fontWeight: 600 }}>{e.description || e.category}</div>
                <div className="tiny">
                  {e.supplier} · {fmtDate(e.date)}
                </div>
              </span>
              <span className="mono">{gbp(e.amount)}</span>
            </div>
          ))}
          <div className="summary-line">
            <span className="muted">Total expenses</span>
            <span className="mono">{gbp(expTotal)}</span>
          </div>
        </div>
      )}

      <div className="section-title">Income received</div>
      {job.stagePayments.filter((p) => p.received).length === 0 ? (
        <p className="muted">No payments received yet.</p>
      ) : (
        <div className="stack-sm">
          {job.stagePayments
            .filter((p) => p.received)
            .map((p) => (
              <div key={p.id} className="line-item">
                <span className="grow">
                  <div style={{ fontWeight: 600 }}>{p.milestone}</div>
                  <div className="tiny">{p.receivedDate ? fmtDate(p.receivedDate) : ''}</div>
                </span>
                <span className="mono text-green">{gbp(p.amount)}</span>
              </div>
            ))}
        </div>
      )}

      <div className="divider" style={{ margin: '12px 0' }} />
      <div className="summary-line">
        <span className="muted">Income received</span>
        <span className="mono">{gbp(received)}</span>
      </div>
      <div className="summary-line">
        <span className="muted">Expenses</span>
        <span className="mono">−{gbp(expTotal)}</span>
      </div>
      <div className="summary-line total">
        <span>Gross profit</span>
        <span className={`mono ${profit >= 0 ? 'text-green' : 'text-red'}`}>{gbp(profit)}</span>
      </div>
      {outstandingTotal(job) > 0 && (
        <div className="callout" style={{ marginTop: 8 }}>
          Outstanding balance: <strong>{gbp(outstandingTotal(job))}</strong> still to collect.
        </div>
      )}
    </Collapsible>
  );
}

// ── Rejection ────────────────────────────────────────────────────────────────
function RejectionSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  return (
    <Collapsible icon="❌" title="Rejection Reason" defaultOpen>
      <p className="muted" style={{ marginTop: 0 }}>
        Why did this one not land? Over time, this is the data that reveals pricing patterns.
      </p>
      <textarea
        className="textarea"
        placeholder="e.g. Price too high, lost to competitor, client went quiet…"
        value={job.rejectionReason ?? ''}
        onChange={(e) =>
          updateJob((j) => {
            j.rejectionReason = e.target.value;
          })
        }
      />
    </Collapsible>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesSection({ job, updateJob }: { job: Job; updateJob: (m: (j: Job) => void) => void }) {
  return (
    <Collapsible icon="📝" title="Job Notes" subtitle={job.notes ? '•' : ''}>
      <textarea
        className="textarea"
        placeholder="Access instructions, client preferences, follow-ups…"
        value={job.notes}
        onChange={(e) =>
          updateJob((j) => {
            j.notes = e.target.value;
          })
        }
      />
    </Collapsible>
  );
}
