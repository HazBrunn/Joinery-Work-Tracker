import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { EmptyState, Field, Sheet } from '../components/ui';
import { useData } from '../store/DataContext';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { uid } from '../lib/id';
import { allIncome, outstandingTotal } from '../lib/calc';
import { jobLabel, jobWithClient } from '../lib/labels';
import { gbp, fmtDate, todayISO } from '../lib/format';

type Tab = 'out' | 'in';
type Range = 'all' | 'month' | '3m' | 'year';

export function Finances() {
  const { data } = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('out');
  const [range, setRange] = useState<Range>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const inRange = (iso: string) => {
    if (range === 'all') return true;
    const d = new Date(iso);
    const now = new Date();
    if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (range === 'year') return d.getFullYear() === now.getFullYear();
    if (range === '3m') {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return d >= cutoff;
    }
    return true;
  };

  const expenses = useMemo(
    () =>
      data.expenses
        .filter((e) => inRange(e.date))
        .filter((e) => (catFilter === 'all' ? true : e.category === catFilter))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.expenses, range, catFilter],
  );

  const income = useMemo(() => allIncome(data).filter((r) => inRange(r.date)), [data, range]);

  const outTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const inTotal = income.reduce((s, e) => s + e.amount, 0);
  const outstanding = data.jobs.reduce((s, j) => s + outstandingTotal(j), 0);

  const catTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) || 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const exportCsv = () => {
    const rows: string[][] = [['Type', 'Date', 'Category', 'Amount', 'Job', 'Supplier/Milestone', 'Description']];
    for (const e of data.expenses) {
      const job = data.jobs.find((j) => j.id === e.linkedJobId)?.title ?? '';
      rows.push(['Expense', e.date, e.category, e.amount.toFixed(2), job, e.supplier, e.description]);
    }
    for (const r of allIncome(data)) {
      rows.push(['Income', r.date, 'Payment', r.amount.toFixed(2), r.jobTitle, r.milestone, '']);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finances-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Screen
      title="Finances"
      action={
        <button className="header-action" onClick={() => setAdding(true)}>
          + Expense
        </button>
      }
    >
      {/* Summary tiles */}
      <div className="metric-grid" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="m-label">Income</div>
          <div className="m-value text-green">{gbp(inTotal)}</div>
        </div>
        <div className="metric">
          <div className="m-label">Outgoings</div>
          <div className="m-value text-red">{gbp(outTotal)}</div>
        </div>
        <div className="metric feature">
          <div className="m-label">Net for period</div>
          <div className="m-value">{gbp(inTotal - outTotal)}</div>
          <div className="m-sub">{gbp(outstanding)} still outstanding across jobs</div>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {(['all', 'month', '3m', 'year'] as Range[]).map((r) => (
          <button key={r} className={`chip ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
            {r === 'all' ? 'All time' : r === 'month' ? 'This month' : r === '3m' ? 'Last 3 mo' : 'This year'}
          </button>
        ))}
      </div>

      <div className="segmented" style={{ marginBottom: 14 }}>
        <button className={tab === 'out' ? 'active' : ''} onClick={() => setTab('out')}>
          Outgoings
        </button>
        <button className={tab === 'in' ? 'active' : ''} onClick={() => setTab('in')}>
          Income
        </button>
      </div>

      {tab === 'out' ? (
        <>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button className={`chip ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>
              All
            </button>
            {EXPENSE_CATEGORIES.map((c) => (
              <button key={c} className={`chip ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
                {c}
              </button>
            ))}
          </div>

          {catTotals.length > 0 && (
            <div className="card pad" style={{ marginBottom: 12 }}>
              <div className="section-title" style={{ margin: '0 0 6px' }}>
                Totals by category
              </div>
              {catTotals.map(([cat, amt]) => (
                <div key={cat} className="summary-line">
                  <span className="muted">{cat}</span>
                  <span className="mono">{gbp(amt)}</span>
                </div>
              ))}
            </div>
          )}

          {expenses.length === 0 ? (
            <EmptyState emoji="💷" title="No outgoings" hint="Log materials, fuel, lead charges and overheads here." />
          ) : (
            <div className="list-grid">
              {expenses.map((e) => {
                const job = data.jobs.find((j) => j.id === e.linkedJobId);
                return (
                  <button key={e.id} className="list-row wrap" onClick={() => setEditing(e)}>
                    <span className="grow">
                      <div className="title">{e.description || e.category}</div>
                      <div className="subtitle">
                        {e.category} · {e.supplier || 'No supplier'}
                        {job ? ` · ${jobWithClient(data, job)}` : ' · Overhead'}
                      </div>
                      <div className="tiny">{fmtDate(e.date)}</div>
                    </span>
                    <span className="mono text-red" style={{ fontWeight: 700, flex: '0 0 auto' }}>
                      −{gbp(e.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <IncomeTab income={income} navigate={navigate} />
      )}

      <button className="btn block" style={{ marginTop: 20 }} onClick={exportCsv}>
        ⬇ Export everything to CSV
      </button>
      <p className="tiny" style={{ textAlign: 'center', marginTop: 8 }}>
        Not VAT registered — finances stay VAT-free for now.
      </p>

      {adding && <ExpenseForm onClose={() => setAdding(false)} />}
      {editing && <ExpenseForm existing={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

function IncomeTab({
  income,
  navigate,
}: {
  income: ReturnType<typeof allIncome>;
  navigate: (to: string) => void;
}) {
  const { data } = useData();
  const outstandingByJob = data.jobs
    .map((j) => ({ job: j, out: outstandingTotal(j) }))
    .filter((x) => x.out > 0)
    .sort((a, b) => b.out - a.out);

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Income is pulled automatically from the payments you mark received on each job.
      </p>

      {income.length === 0 ? (
        <EmptyState emoji="🪙" title="No income yet" hint="Mark payments as received inside a job." />
      ) : (
        <div className="list-grid">
          {income.map((r) => (
            <button key={r.id} className="list-row wrap" onClick={() => navigate(`/jobs/${r.jobId}`)}>
              <span className="grow">
                <div className="title">{r.milestone}</div>
                <div className="subtitle">{jobWithClient(data, data.jobs.find((j) => j.id === r.jobId))}</div>
                <div className="tiny">{fmtDate(r.date)}</div>
              </span>
              <span className="mono text-green" style={{ fontWeight: 700, flex: '0 0 auto' }}>
                +{gbp(r.amount)}
              </span>
            </button>
          ))}
        </div>
      )}

      {outstandingByJob.length > 0 && (
        <>
          <div className="section-title">Outstanding — still owed</div>
          <div className="stack">
            {outstandingByJob.map(({ job, out }) => (
              <button key={job.id} className="list-row wrap" onClick={() => navigate(`/jobs/${job.id}`)}>
                <span className="grow">
                  <div className="title">{jobWithClient(data, job)}</div>
                  <div className="subtitle">Agreed {gbp(job.agreedPrice ?? 0)}</div>
                </span>
                <span className="mono text-amber" style={{ fontWeight: 700, flex: '0 0 auto' }}>
                  {gbp(out)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function ExpenseForm({ existing, onClose }: { existing?: Expense; onClose: () => void }) {
  const { data, update } = useData();
  const [form, setForm] = useState<Expense>(
    existing ?? {
      id: uid(),
      date: todayISO(),
      amount: 0,
      category: 'Materials',
      linkedJobId: null,
      supplier: '',
      description: '',
    },
  );
  const set = (patch: Partial<Expense>) => setForm((f) => ({ ...f, ...patch }));

  // Suppliers you have used before, the most-used first. Typing "How" should
  // find Howdens rather than making you spell it again — and consistent
  // spelling is what makes the category totals mean anything.
  const suppliers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data.expenses) {
      const name = e.supplier?.trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
  }, [data.expenses]);

  const save = () => {
    if (!form.amount) return;
    update((draft) => {
      const idx = draft.expenses.findIndex((e) => e.id === form.id);
      if (idx >= 0) draft.expenses[idx] = form;
      else draft.expenses.push(form);
    });
    onClose();
  };
  const remove = () => {
    update((draft) => {
      draft.expenses = draft.expenses.filter((e) => e.id !== form.id);
    });
    onClose();
  };

  return (
    <Sheet title={existing ? 'Edit expense' : 'Log expense'} onClose={onClose}>
      <div className="stack">
        <div className="field-row">
          {/* No autoFocus: opening the sheet threw the keyboard up over half of
              it before you had decided what you were logging. */}
          <Field label="Amount (£)">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={form.amount || ''}
              onChange={(e) => set({ amount: +e.target.value })}
            />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        <Field label="Category">
          <select
            className="select"
            value={form.category}
            onChange={(e) => set({ category: e.target.value as ExpenseCategory })}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Linked job (optional — leave blank for overheads)">
          <select
            className="select"
            value={form.linkedJobId ?? ''}
            onChange={(e) => set({ linkedJobId: e.target.value || null })}
          >
            <option value="">— Overhead (no job) —</option>
            {/* Titles repeat across clients, so the client's initials come too:
                three jobs called "Fitted Wardrobes" are otherwise the same
                option three times. */}
            {data.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {jobLabel(data, j)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supplier">
          <input
            className="input"
            list="supplier-suggestions"
            autoComplete="off"
            value={form.supplier}
            onChange={(e) => set({ supplier: e.target.value })}
          />
          <datalist id="supplier-suggestions">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Description">
          <input className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      <div className="sheet-actions">
        {existing ? (
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
        ) : (
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="btn primary" onClick={save} disabled={!form.amount}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
