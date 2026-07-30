import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { EmptyState, Field, PriorityDot, Sheet } from '../components/ui';
import { useData } from '../store/DataContext';
import { CalendarBlock, Job } from '../types';
import { jobWithClient } from '../lib/labels';
import { uid } from '../lib/id';
import {
  dateKey,
  daysBetween,
  fmtDateShort,
  fmtDateTime,
  relativeDeadline,
  todayISO,
} from '../lib/format';

type View = 'month' | 'list';

// A derived, unified calendar event for display. Blocks spanning several days
// produce one event per day they cover, all sharing the same blockId.
interface CalEvent {
  id: string;
  kind: 'visit' | 'task' | 'prospective' | 'confirmed' | 'time_off';
  date: string; // the day this event sits on (yyyy-mm-dd)
  datetime?: string; // for ordering within a day
  title: string;
  jobId: string | null;
  jobTitle?: string;
  priority?: 'red' | 'amber' | 'green';
  done?: boolean;
  color: string;
  /** Set on events derived from a CalendarBlock, for confirm/remove actions. */
  blockId?: string;
  /** Set on events derived from a JobTask, for tick-to-complete. */
  taskId?: string;
  /** Full extent of the underlying block, for showing a date range. */
  spanStart?: string;
  spanEnd?: string;
}

// yyyy-mm-dd → "7 Aug", parsed as local midnight so the day never shifts.
function shortDay(day: string): string {
  return fmtDateShort(`${day}T00:00:00`);
}

// "7 – 9 Aug" for a multi-day block, a single date for a one-day one.
function spanLabel(e: CalEvent): string {
  if (e.spanStart && e.spanEnd && e.spanStart !== e.spanEnd) {
    return `${shortDay(e.spanStart)} – ${shortDay(e.spanEnd)}`;
  }
  return shortDay(e.date);
}

const KIND_COLOR: Record<CalEvent['kind'], string> = {
  visit: '#3e6fb0',
  task: '#7a5bb0',
  prospective: '#e8a020',
  confirmed: '#2e8b57',
  time_off: '#8a96a6',
};

export function Calendar() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // The day a new block should default to. Held separately from selectedDay so
  // the day sheet can close before the block form opens without losing it.
  const [blockPreset, setBlockPreset] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Build all events from jobs + blocks.
  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    for (const job of data.jobs) {
      if (job.visitDate) {
        out.push({
          id: `visit-${job.id}`,
          kind: 'visit',
          date: dateKey(new Date(job.visitDate)),
          datetime: job.visitDate,
          title: `Quote visit — ${jobWithClient(data, job)}`,
          jobId: job.id,
          jobTitle: jobWithClient(data, job),
          color: KIND_COLOR.visit,
        });
      }
      for (const t of job.tasks) {
        if (!t.deadline) continue;
        out.push({
          id: `task-${t.id}`,
          kind: 'task',
          date: dateKey(new Date(t.deadline)),
          datetime: t.deadline,
          title: t.title,
          jobId: job.id,
          // Whose job it is, not just which job: "Order hinges · Fitted
          // Wardrobes" is three different tasks when three clients want them.
          jobTitle: jobWithClient(data, job),
          priority: t.priority,
          done: t.done,
          color: KIND_COLOR.task,
          taskId: t.id,
        });
      }
    }
    for (const b of data.calendarBlocks) {
      // A block covers every day from start to end inclusive, so emit an event
      // for each of them: the month grid then marks the whole run, and any day
      // in the middle can confirm or remove the block. (Previously only the
      // start date carried the event, so day two of a booked install showed
      // nothing at all.) The fallback keeps a malformed range visible.
      const days = daysBetween(b.startDate, b.endDate);
      const span = days.length > 0 ? days : [b.startDate];
      for (const day of span) {
        out.push({
          id: `block-${b.id}-${day}`,
          kind: b.type,
          date: day,
          title: b.label,
          jobId: b.jobId,
          jobTitle: jobWithClient(data, data.jobs.find((j) => j.id === b.jobId)),
          color: KIND_COLOR[b.type],
          blockId: b.id,
          spanStart: b.startDate,
          spanEnd: b.endDate,
        });
      }
    }
    return out;
  }, [data.jobs, data.calendarBlocks]);

  // Per-day booked hours from prospective + confirmed blocks → clash detection.
  const dayHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of data.calendarBlocks) {
      if (b.type === 'time_off') continue;
      const days = daysBetween(b.startDate, b.endDate);
      if (days.length === 0) continue;
      const perDay = b.hours / days.length;
      for (const d of days) map.set(d, (map.get(d) || 0) + perDay);
    }
    return map;
  }, [data.calendarBlocks]);

  const timeOffDays = useMemo(() => {
    const set = new Set<string>();
    for (const b of data.calendarBlocks) {
      if (b.type !== 'time_off') continue;
      for (const d of daysBetween(b.startDate, b.endDate)) set.add(d);
    }
    return set;
  }, [data.calendarBlocks]);

  const capacity = data.settings.workingHoursPerDay || 8;

  return (
    <Screen
      title="Calendar"
      action={
        <button
          className="header-action"
          onClick={() => {
            setBlockPreset(null);
            setAdding(true);
          }}
        >
          + Block
        </button>
      }
    >
      <div className="segmented" style={{ marginBottom: 14 }}>
        <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
          Calendar
        </button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          List
        </button>
      </div>

      {view === 'month' ? (
        <MonthGrid
          cursor={cursor}
          setCursor={setCursor}
          events={events}
          dayHours={dayHours}
          timeOffDays={timeOffDays}
          capacity={capacity}
          onSelectDay={setSelectedDay}
        />
      ) : (
        <ListView events={events} showDone={showDone} setShowDone={setShowDone} navigate={navigate} />
      )}

      <Legend />

      {adding && (
        <BlockForm
          jobs={data.jobs}
          capacity={capacity}
          presetDate={blockPreset ?? undefined}
          onClose={() => setAdding(false)}
          onSave={(block) => {
            update((draft) => {
              draft.calendarBlocks.push(block);
            });
            setAdding(false);
          }}
        />
      )}

      {selectedDay && (
        <DaySheet
          day={selectedDay}
          events={events.filter((e) => e.date === selectedDay)}
          booked={dayHours.get(selectedDay) || 0}
          capacity={capacity}
          isTimeOff={timeOffDays.has(selectedDay)}
          onClose={() => setSelectedDay(null)}
          onAdd={() => {
            // Close the day sheet before opening the block form, otherwise the
            // two stack on top of each other.
            setBlockPreset(selectedDay);
            setSelectedDay(null);
            setAdding(true);
          }}
          onOpenJob={(jid) => {
            setSelectedDay(null);
            navigate(`/jobs/${jid}`);
          }}
        />
      )}
    </Screen>
  );
}

function MonthGrid({
  cursor,
  setCursor,
  events,
  dayHours,
  timeOffDays,
  capacity,
  onSelectDay,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  events: CalEvent[];
  dayHours: Map<string, number>;
  timeOffDays: Set<string>;
  capacity: number;
  onSelectDay: (d: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = dateKey(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dateKey(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const arr = eventsByDay.get(e.date) || [];
    arr.push(e);
    eventsByDay.set(e.date, arr);
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="btn-icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          ‹
        </button>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          {cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </div>
        <button className="btn-icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          ›
        </button>
      </div>

      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div className="cal-dow" key={d}>
            {d}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const evs = eventsByDay.get(day) || [];
          const booked = dayHours.get(day) || 0;
          const clash = booked > capacity + 0.001;
          const isTimeOff = timeOffDays.has(day);
          return (
            <button
              key={i}
              className={`cal-cell ${day === today ? 'today' : ''} ${isTimeOff ? 'timeoff' : ''} ${clash ? 'clash' : ''}`}
              onClick={() => onSelectDay(day)}
            >
              <span className="cal-num">{parseInt(day.slice(8), 10)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {evs.slice(0, 3).map((e) => (
                  <span key={e.id} className="cal-bar" style={{ background: e.color, opacity: e.done ? 0.4 : 1 }} />
                ))}
                {evs.length > 3 && <span className="tiny">+{evs.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <p className="tiny" style={{ marginTop: 10 }}>
        Tap a day to see what's on and block out work. A red “!” means booked hours exceed your{' '}
        {capacity}h/day capacity.
      </p>
    </>
  );
}

function ListView({
  events,
  showDone,
  setShowDone,
  navigate,
}: {
  events: CalEvent[];
  showDone: boolean;
  setShowDone: (b: boolean) => void;
  navigate: (to: string) => void;
}) {
  const { update } = useData();
  const today = todayISO();
  const upcoming = events
    .filter((e) => e.date >= today || (e.kind === 'task' && !e.done))
    .filter((e) => (showDone ? true : !e.done))
    .sort((a, b) => {
      const ad = a.datetime || a.date;
      const bd = b.datetime || b.date;
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    })
    // A multi-day block is one thing to do, not one per day — collapse it to its
    // earliest still-relevant day and label it with the full range. Filtering
    // first means a block already under way shows from today rather than from a
    // start date that has passed.
    .filter((e, _i, all) => !e.blockId || all.find((x) => x.blockId === e.blockId) === e);

  const toggleTask = (taskId: string) => {
    update((draft) => {
      for (const job of draft.jobs) {
        const idx = job.tasks.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          const t = job.tasks[idx];
          job.tasks = job.tasks.map((x) =>
            x.id === taskId ? { ...x, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined } : x,
          );
        }
      }
    });
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Upcoming
        </div>
        <button className="btn sm ghost" onClick={() => setShowDone(!showDone)}>
          {showDone ? 'Hide done' : 'Show done'}
        </button>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState emoji="📅" title="Nothing scheduled" hint="Add task deadlines, quote visits, or job blocks." />
      ) : (
        <div className="stack">
          {upcoming.map((e) => {
            const rel = e.datetime ? relativeDeadline(e.datetime) : { text: '', overdue: false };
            const taskId = e.taskId ?? null;
            return (
              <div key={e.id} className="list-row">
                {taskId ? (
                  <button
                    className="btn-icon"
                    onClick={() => toggleTask(taskId)}
                    style={{ background: e.done ? 'var(--green)' : 'var(--pill)', color: e.done ? '#fff' : 'var(--text-3)' }}
                  >
                    {e.done ? '✓' : ''}
                  </button>
                ) : (
                  <span className="dot" style={{ background: e.color, width: 12, height: 12 }} />
                )}
                <button
                  className="grow"
                  style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, color: 'var(--text)' }}
                  onClick={() => e.jobId && navigate(`/jobs/${e.jobId}`)}
                >
                  <div className="row" style={{ gap: 6 }}>
                    {e.priority && <PriorityDot priority={e.priority} />}
                    <span className={`title ${e.done ? 'strike' : ''}`}>{e.title}</span>
                  </div>
                  <div className="subtitle">
                    <KindLabel kind={e.kind} /> {e.jobTitle && e.kind !== 'visit' ? `· ${e.jobTitle}` : ''}
                  </div>
                </button>
                <span className={`tiny nowrap ${rel.overdue ? 'text-red' : ''}`}>
                  {e.datetime ? fmtDateTime(e.datetime) : spanLabel(e)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function KindLabel({ kind }: { kind: CalEvent['kind'] }) {
  const labels: Record<CalEvent['kind'], string> = {
    visit: 'Quote visit',
    task: 'Task',
    prospective: 'Prospective block',
    confirmed: 'Confirmed job',
    time_off: 'Time off',
  };
  return <>{labels[kind]}</>;
}

function Legend() {
  const items: { kind: CalEvent['kind']; label: string }[] = [
    { kind: 'visit', label: 'Visit' },
    { kind: 'task', label: 'Task' },
    { kind: 'prospective', label: 'Prospective' },
    { kind: 'confirmed', label: 'Confirmed' },
    { kind: 'time_off', label: 'Time off' },
  ];
  return (
    <div className="row wrap" style={{ gap: 10, marginTop: 16, justifyContent: 'center' }}>
      {items.map((i) => (
        <span key={i.kind} className="row" style={{ gap: 5 }}>
          <span className="dot" style={{ background: KIND_COLOR[i.kind] }} />
          <span className="tiny">{i.label}</span>
        </span>
      ))}
    </div>
  );
}

function DaySheet({
  day,
  events,
  booked,
  capacity,
  isTimeOff,
  onClose,
  onAdd,
  onOpenJob,
}: {
  day: string;
  events: CalEvent[];
  booked: number;
  capacity: number;
  isTimeOff: boolean;
  onClose: () => void;
  onAdd: () => void;
  onOpenJob: (jobId: string) => void;
}) {
  const { data, update } = useData();
  const clash = booked > capacity + 0.001;

  // Confirm a prospective block (tick to confirm).
  const confirmBlock = (blockId: string) => {
    update((draft) => {
      const b = draft.calendarBlocks.find((x) => x.id === blockId);
      if (b) b.type = 'confirmed';
    });
  };
  const removeBlock = (blockId: string) => {
    update((draft) => {
      draft.calendarBlocks = draft.calendarBlocks.filter((x) => x.id !== blockId);
    });
  };

  return (
    <Sheet
      title={new Date(day + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
      onClose={onClose}
    >
      {isTimeOff && <div className="callout" style={{ marginBottom: 12 }}>🌴 Time off — light admin only.</div>}
      {booked > 0 && (
        <div className={`callout ${clash ? 'warn' : 'ok'}`} style={{ marginBottom: 12 }}>
          {clash ? '⚠️ Overbooked: ' : '✓ '}
          {(+booked.toFixed(1)).toString()}h booked of {capacity}h capacity.
        </div>
      )}

      {events.length === 0 ? (
        <p className="muted">Nothing on this day yet.</p>
      ) : (
        <div className="stack-sm">
          {events.map((e) => {
            const block = e.blockId ? data.calendarBlocks.find((b) => b.id === e.blockId) : null;
            const multiDay = e.spanStart !== e.spanEnd;
            return (
              <div key={e.id} className="line-item">
                <span className="dot" style={{ background: e.color }} />
                <span className="grow">
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div className="tiny">
                    <KindLabel kind={e.kind} />
                    {block && multiDay ? ` · ${spanLabel(e)}` : ''}
                  </div>
                </span>
                {block && block.type === 'prospective' && (
                  <button className="btn sm amber" onClick={() => confirmBlock(block.id)}>
                    Confirm
                  </button>
                )}
                {e.jobId && (
                  <button className="btn-icon" onClick={() => onOpenJob(e.jobId!)}>
                    ›
                  </button>
                )}
                {block && (
                  <button className="btn-icon" onClick={() => removeBlock(block.id)}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button className="btn primary block" style={{ marginTop: 16 }} onClick={onAdd}>
        + Block out work / time off
      </button>
    </Sheet>
  );
}

function BlockForm({
  jobs,
  capacity,
  presetDate,
  onClose,
  onSave,
}: {
  jobs: Job[];
  capacity: number;
  presetDate?: string;
  onClose: () => void;
  onSave: (block: CalendarBlock) => void;
}) {
  const [type, setType] = useState<'prospective' | 'time_off'>('prospective');
  const [jobId, setJobId] = useState<string>(jobs.find((j) => j.status === 'accepted')?.id ?? jobs[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [start, setStart] = useState(presetDate ?? todayISO());
  const [end, setEnd] = useState(presetDate ?? todayISO());
  const [days, setDays] = useState('1');

  const save = () => {
    const block: CalendarBlock = {
      id: uid(),
      type,
      jobId: type === 'time_off' ? null : jobId || null,
      label:
        label.trim() ||
        (type === 'time_off'
          ? 'Time off'
          : `${jobs.find((j) => j.id === jobId)?.title ?? 'Job'} (provisional)`),
      startDate: start,
      endDate: end < start ? start : end,
      hours: type === 'time_off' ? 0 : parseFloat(days || '1') * capacity,
    };
    onSave(block);
  };

  return (
    <Sheet title="Block out time" onClose={onClose}>
      <div className="stack">
        <div className="segmented">
          <button className={type === 'prospective' ? 'active' : ''} onClick={() => setType('prospective')}>
            Prospective job
          </button>
          <button className={type === 'time_off' ? 'active' : ''} onClick={() => setType('time_off')}>
            Time off
          </button>
        </div>

        {type === 'prospective' && (
          <Field label="Job">
            <select className="select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Label">
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={type === 'time_off' ? 'e.g. Holiday' : 'e.g. Kitchen install (provisional)'}
          />
        </Field>

        <div className="field-row">
          <Field label="Start">
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End">
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        {type === 'prospective' && (
          <Field label={`Estimated work (days @ ${capacity}h)`}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
        )}
        <p className="tiny" style={{ margin: 0 }}>
          {type === 'prospective'
            ? 'Shown in amber as provisional. Tick “Confirm” on the day to lock it in (turns green).'
            : 'Those days grey out, but you can still log light admin like ordering materials.'}
        </p>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save}>
          Add block
        </button>
      </div>
    </Sheet>
  );
}
