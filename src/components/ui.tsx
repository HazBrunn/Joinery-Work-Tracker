// Small shared UI primitives used across modules.
import { ReactNode, useState } from 'react';
import { JobStatus, JOB_STATUSES, Priority, PRIORITIES } from '../types';

export function StatusBadge({ status, onClick }: { status: JobStatus; onClick?: () => void }) {
  const s = JOB_STATUSES.find((x) => x.value === status)!;
  return (
    <span
      className="badge"
      style={{ background: s.color, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
    >
      <span>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: Priority }) {
  const p = PRIORITIES.find((x) => x.value === priority)!;
  return <span className="dot" style={{ background: p.color }} title={p.label} />;
}

export function Collapsible({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <button className="collapsible-head" onClick={() => setOpen((o) => !o)} type="button">
        <span className="c-icon">{icon}</span>
        <span className="c-title">{title}</span>
        {subtitle != null && <span className="c-sub">{subtitle}</span>}
        <span className="chevron">▶</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  hint,
  action,
}: {
  emoji: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="emoji">{emoji}</div>
      <h3>{title}</h3>
      {hint && <p className="muted">{hint}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Simple bar chart (6-month trend etc).
export function BarChart({
  data,
  highlightLast = true,
  format,
}: {
  data: { label: string; value: number }[];
  highlightLast?: boolean;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isLast = i === data.length - 1;
        return (
          <div className="bar-col" key={i}>
            <div
              className={`bar ${highlightLast && isLast ? 'amber' : ''}`}
              style={{ height: `${Math.max(3, pct)}%` }}
              title={format ? format(d.value) : String(d.value)}
            />
            <div className="bar-label">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
