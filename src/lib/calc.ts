// Business calculations — quotes, time, profit, finances, dashboard metrics.
import {
  AppData,
  Expense,
  Job,
  StagePayment,
} from '../types';

// ── Quote ──────────────────────────────────────────────────────────────────
export function materialsTotal(job: Job): number {
  return job.quote.materials.reduce((s, m) => s + (m.quantity || 0) * (m.unitCost || 0), 0);
}

export function hourlyRate(dayRate: number, hoursPerDay = 8): number {
  return hoursPerDay ? dayRate / hoursPerDay : 0;
}

export function labourEstimate(job: Job, hoursPerDay = 8): number {
  return hourlyRate(job.quote.dayRate, hoursPerDay) * (job.quote.estimatedHours || 0);
}

export function suggestedQuote(job: Job, hoursPerDay = 8): number {
  return materialsTotal(job) + labourEstimate(job, hoursPerDay);
}

// ── Stage payments ───────────────────────────────────────────────────────────
export function stagePaymentsTotal(job: Job): number {
  return job.stagePayments.reduce((s, p) => s + (p.amount || 0), 0);
}

export function receivedTotal(job: Job): number {
  return job.stagePayments.filter((p) => p.received).reduce((s, p) => s + (p.amount || 0), 0);
}

export function outstandingTotal(job: Job): number {
  const agreed = job.agreedPrice ?? stagePaymentsTotal(job);
  const received = receivedTotal(job);
  return Math.max(0, agreed - received);
}

// True if stage payments are present but don't reconcile to the agreed price.
export function stagePaymentsMismatch(job: Job): boolean {
  if (job.agreedPrice == null) return false;
  if (job.stagePayments.length === 0) return false;
  return Math.abs(stagePaymentsTotal(job) - job.agreedPrice) > 0.005;
}

// ── Time ─────────────────────────────────────────────────────────────────────
export function totalHours(job: Job): number {
  return job.timeEntries.reduce((s, t) => s + (t.hours || 0), 0);
}

// ── Expenses / profit ──────────────────────────────────────────────────────
export function jobExpenses(data: AppData, jobId: string): Expense[] {
  return data.expenses.filter((e) => e.linkedJobId === jobId);
}

export function jobExpensesTotal(data: AppData, jobId: string): number {
  return jobExpenses(data, jobId).reduce((s, e) => s + (e.amount || 0), 0);
}

export function grossProfit(data: AppData, job: Job): number {
  return receivedTotal(job) - jobExpensesTotal(data, job.id);
}

// Effective rate: final/received income ÷ actual hours.
export function effectiveHourly(_data: AppData, job: Job): number | null {
  const hours = totalHours(job);
  if (!hours) return null;
  return receivedTotal(job) / hours;
}

export function effectiveDaily(
  data: AppData,
  job: Job,
  hoursPerDay = 8,
): number | null {
  const hourly = effectiveHourly(data, job);
  return hourly == null ? null : hourly * hoursPerDay;
}

// ── Finances: all received stage payments as income rows ─────────────────────
export interface IncomeRow {
  id: string;
  jobId: string;
  jobTitle: string;
  milestone: string;
  amount: number;
  date: string;
}

export function allIncome(data: AppData): IncomeRow[] {
  const rows: IncomeRow[] = [];
  for (const job of data.jobs) {
    for (const p of job.stagePayments) {
      if (p.received) {
        rows.push({
          id: p.id,
          jobId: job.id,
          jobTitle: job.title,
          milestone: p.milestone,
          amount: p.amount,
          date: p.receivedDate || job.dateAdded,
        });
      }
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ── Date helpers for periods ─────────────────────────────────────────────────
function inMonth(iso: string | undefined, year: number, month: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

// ── Dashboard metrics ────────────────────────────────────────────────────────
export interface DashboardMetrics {
  activeJobs: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  outstanding: number;
  effectiveDayRate: number | null;
  rateByCategory: { category: string; rate: number; jobs: number }[];
  winRate: number | null;
  trend: { label: string; income: number }[];
}

export function dashboardMetrics(data: AppData): DashboardMetrics {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const hpd = data.settings.workingHoursPerDay || 8;

  const activeJobs = data.jobs.filter(
    (j) => j.status === 'in_progress' || j.status === 'quoted' || j.status === 'accepted',
  ).length;

  // Monthly income from received stage payments dated this month.
  let monthlyIncome = 0;
  for (const job of data.jobs) {
    for (const p of job.stagePayments) {
      if (p.received && inMonth(p.receivedDate, y, m)) monthlyIncome += p.amount;
    }
  }

  const monthlyExpenses = data.expenses
    .filter((e) => inMonth(e.date, y, m))
    .reduce((s, e) => s + e.amount, 0);

  const outstanding = data.jobs.reduce((s, j) => s + outstandingTotal(j), 0);

  // Effective day rate overall: total received ÷ total hours × hoursPerDay.
  let totalReceived = 0;
  let totalHrs = 0;
  for (const job of data.jobs) {
    totalReceived += receivedTotal(job);
    totalHrs += totalHours(job);
  }
  const effectiveDayRate = totalHrs ? (totalReceived / totalHrs) * hpd : null;

  // Rate by category — effective £/day per category.
  const catMap = new Map<string, { received: number; hours: number; jobs: Set<string> }>();
  for (const job of data.jobs) {
    const hrs = totalHours(job);
    if (!hrs) continue;
    const entry = catMap.get(job.category) || { received: 0, hours: 0, jobs: new Set<string>() };
    entry.received += receivedTotal(job);
    entry.hours += hrs;
    entry.jobs.add(job.id);
    catMap.set(job.category, entry);
  }
  const rateByCategory = [...catMap.entries()]
    .map(([category, v]) => ({
      category,
      rate: v.hours ? (v.received / v.hours) * hpd : 0,
      jobs: v.jobs.size,
    }))
    .filter((r) => r.rate > 0)
    .sort((a, b) => b.rate - a.rate);

  // Win rate — accepted / (accepted + rejected) among jobs that were quoted.
  const decided = data.jobs.filter(
    (j) => j.status === 'accepted' || j.status === 'in_progress' || j.status === 'completed' || j.status === 'rejected',
  );
  const won = decided.filter((j) => j.status !== 'rejected').length;
  const winRate = decided.length ? won / decided.length : null;

  // 6-month income trend.
  const trend: { label: string; income: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    let income = 0;
    for (const job of data.jobs) {
      for (const p of job.stagePayments) {
        if (p.received && inMonth(p.receivedDate, d.getFullYear(), d.getMonth())) income += p.amount;
      }
    }
    trend.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), income });
  }

  return {
    activeJobs,
    monthlyIncome,
    monthlyExpenses,
    monthlyProfit: monthlyIncome - monthlyExpenses,
    outstanding,
    effectiveDayRate,
    rateByCategory,
    winRate,
    trend,
  };
}

// Nearest upcoming task deadline across all jobs.
export interface NextDeadline {
  jobId: string;
  jobTitle: string;
  taskTitle: string;
  deadline: string;
}

export function nextDeadline(data: AppData): NextDeadline | null {
  const now = Date.now();
  let best: NextDeadline | null = null;
  for (const job of data.jobs) {
    for (const t of job.tasks) {
      if (t.done || !t.deadline) continue;
      const ts = new Date(t.deadline).getTime();
      if (isNaN(ts) || ts < now) continue;
      if (!best || ts < new Date(best.deadline).getTime()) {
        best = { jobId: job.id, jobTitle: job.title, taskTitle: t.title, deadline: t.deadline };
      }
    }
  }
  return best;
}

export function clientById(data: AppData, id: string | null) {
  return data.clients.find((c) => c.id === id) || null;
}

export function jobById(data: AppData, id: string) {
  return data.jobs.find((j) => j.id === id) || null;
}

export function jobsForClient(data: AppData, clientId: string): Job[] {
  return data.jobs.filter((j) => j.clientId === clientId);
}

export function isReceivable(p: StagePayment): boolean {
  return !p.received;
}
