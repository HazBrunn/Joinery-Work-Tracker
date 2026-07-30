import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart } from '../components/ui';
import { useData } from '../store/DataContext';
import { dashboardMetrics, nextDeadlines } from '../lib/calc';
import { jobWithClient } from '../lib/labels';
import { gbp, fmtDate, relativeDeadline } from '../lib/format';
import { NewJobForm } from './Jobs';
import { ClientForm } from './Clients';
import { ExpenseForm } from './Finances';

export function Dashboard() {
  const { data } = useData();
  const navigate = useNavigate();
  const metrics = useMemo(() => dashboardMetrics(data), [data]);
  const deadlines = useMemo(() => nextDeadlines(data, 3), [data]);
  const [sheet, setSheet] = useState<null | 'job' | 'client' | 'expense'>(null);

  const greeting = greetingFor(new Date());

  return (
    <>
      <header className="app-header">
        <h1>{data.settings.businessName || 'Joinery Tracker'}</h1>
        <button className="header-action" onClick={() => navigate('/settings')} aria-label="Settings">
          ⚙
        </button>
      </header>
      <div className="content">
        <p className="muted" style={{ margin: '0 4px 14px' }}>
          {greeting} Here's where the business stands.
        </p>

        {/* Hero: effective day rate */}
        <div className="metric feature" style={{ marginBottom: 12 }}>
          <div className="m-label">Effective day rate</div>
          <div className="m-value">
            {metrics.effectiveDayRate != null ? gbp(metrics.effectiveDayRate) : '—'}
          </div>
          <div className="m-sub">
            {metrics.effectiveDayRate != null
              ? 'What you actually earn per worked day'
              : 'Log time + payments to see this'}
          </div>
        </div>

        <div className="metric-grid">
          <Tile label="Active jobs" value={String(metrics.activeJobs)} onClick={() => navigate('/jobs')} />
          <Tile
            label="Win rate"
            value={metrics.winRate != null ? `${Math.round(metrics.winRate * 100)}%` : '—'}
            sub="Quotes won"
          />
          <Tile label="This month" value={gbp(metrics.monthlyIncome)} sub="Income received" />
          <Tile
            label="Monthly profit"
            value={gbp(metrics.monthlyProfit)}
            sub="After expenses"
            valueClass={metrics.monthlyProfit >= 0 ? 'text-green' : 'text-red'}
          />
          <Tile
            label="Outstanding"
            value={gbp(metrics.outstanding)}
            sub="Owed across jobs"
            onClick={() => navigate('/finances')}
            valueClass="text-amber"
          />
          <Tile label="Clients" value={String(data.clients.length)} onClick={() => navigate('/clients')} />
        </div>

        <div className="panel-grid" style={{ marginTop: 14 }}>
          {/* Income trend */}
          <div className="card pad">
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>
                Income — last 6 months
              </div>
            </div>
            <BarChart data={metrics.trend.map((t) => ({ label: t.label, value: t.income }))} format={(n) => gbp(n)} />
          </div>

          {/* What's coming. Three rather than one: knowing only the very next
              thing tells you nothing about whether this week is busy. */}
          {deadlines.length > 0 && (
            <div className="card pad">
              <div className="section-title" style={{ margin: '0 0 8px' }}>
                {deadlines.length > 1 ? 'Next deadlines' : 'Next deadline'}
              </div>
              <div className="stack-sm">
                {deadlines.map((d) => {
                  const rel = relativeDeadline(d.deadline);
                  return (
                    <button
                      key={`${d.jobId}-${d.deadline}-${d.taskTitle}`}
                      className="row between"
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, gap: 10, color: 'var(--text)' }}
                      onClick={() => navigate(`/jobs/${d.jobId}`)}
                    >
                      <span className="grow" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{d.taskTitle}</div>
                        <div className="tiny" style={{ overflowWrap: 'anywhere' }}>
                          {jobWithClient(data, data.jobs.find((j) => j.id === d.jobId))} · {fmtDate(d.deadline)}
                        </div>
                      </span>
                      <span className={`pill ${rel.overdue ? 'text-red' : ''}`} style={{ fontWeight: 700, flex: '0 0 auto' }}>
                        {rel.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rate by category */}
          {metrics.rateByCategory.length > 0 && (
            <div className="card pad">
              <div className="section-title" style={{ margin: '0 0 8px' }}>
                Effective £/day by category
              </div>
              {metrics.rateByCategory.map((r) => (
                <div key={r.category} className="summary-line">
                  <span className="muted">
                    {r.category} <span className="tiny">· {r.jobs} job{r.jobs === 1 ? '' : 's'}</span>
                  </span>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    {gbp(r.rate)}
                  </span>
                </div>
              ))}
              <p className="tiny" style={{ marginTop: 6 }}>
                Which work actually pays best per day.
              </p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="section-title">Quick actions</div>
        <div className="metric-grid">
          <QuickAction icon="🔨" label="Add job" onClick={() => setSheet('job')} />
          <QuickAction icon="👤" label="Add client" onClick={() => setSheet('client')} />
          <QuickAction icon="💷" label="Log expense" onClick={() => setSheet('expense')} />
          <QuickAction icon="📅" label="This week" onClick={() => navigate('/calendar')} />
        </div>
      </div>

      {sheet === 'job' && (
        <NewJobForm
          onClose={() => setSheet(null)}
          onSaved={(id) => {
            setSheet(null);
            navigate(`/jobs/${id}`);
          }}
        />
      )}
      {sheet === 'client' && <ClientForm onClose={() => setSheet(null)} />}
      {sheet === 'expense' && <ExpenseForm onClose={() => setSheet(null)} />}
    </>
  );
}

function Tile({
  label,
  value,
  sub,
  onClick,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
  valueClass?: string;
}) {
  return (
    <div className="metric" style={{ cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div className="m-label">{label}</div>
      <div className={`m-value ${valueClass ?? ''}`}>{value}</div>
      {sub && <div className="m-sub">{sub}</div>}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="metric" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={onClick}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}
