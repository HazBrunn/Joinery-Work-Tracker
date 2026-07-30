// Formatting helpers — currency in GBP, hours/days, and dates.

export function gbp(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function gbp2(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

// Hours → friendly "X days Yh" or "Xh", given a day length.
export function hoursLabel(hours: number, hoursPerDay = 8): string {
  if (!hours) return '0h';
  if (hours < hoursPerDay) return `${trim(hours)}h`;
  const days = Math.floor(hours / hoursPerDay);
  const rem = +(hours - days * hoursPerDay).toFixed(2);
  return rem ? `${days}d ${trim(rem)}h` : `${days}d`;
}

function trim(n: number): string {
  return (+n.toFixed(2)).toString();
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// A task is due on a day, not at a minute. Stored at local midday so that
// reading the day back out is stable wherever you are and whatever the clocks
// have done — midnight would land on the previous day in some timezones.
export function deadlineISO(dateOnly: string): string | undefined {
  if (!dateOnly) return undefined;
  const [y, m, d] = dateOnly.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Today as yyyy-mm-dd in LOCAL time. Deliberately not toISOString(), which is
// UTC and so returns yesterday during British Summer Time between midnight and
// 1am — enough to date a stage payment or an expense to the wrong day.
export function todayISO(): string {
  return dateKey(new Date());
}

// yyyy-mm-dd for a Date in local time (avoids UTC off-by-one).
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  const cur = new Date(start);
  while (cur <= end) {
    out.push(dateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function relativeDeadline(iso?: string): { text: string; overdue: boolean } {
  if (!iso) return { text: '', overdue: false };
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const day = 86400000;
  const overdue = diffMs < 0;
  const absDays = Math.round(Math.abs(diffMs) / day);
  if (Math.abs(diffMs) < day && d.toDateString() === now.toDateString()) {
    return { text: 'Today', overdue };
  }
  if (overdue) return { text: `${absDays}d overdue`, overdue: true };
  if (absDays === 0) return { text: 'Today', overdue: false };
  if (absDays === 1) return { text: 'Tomorrow', overdue: false };
  return { text: `in ${absDays}d`, overdue: false };
}
