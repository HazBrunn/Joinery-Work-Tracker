// Full-dataset backup and restore as a single JSON file.
//
// This is the app's own escape hatch: everything the tracker knows, in a plain
// file you keep. It is also the first step of any backend migration — export
// here, transform, import there.
import { AppData, DEFAULT_SETTINGS } from '../types';
import { todayISO } from './format';

const FORMAT = 'joinery-jobs-tracker/backup';
const VERSION = 1;

interface BackupEnvelope {
  format: string;
  version: number;
  exportedAt: string;
  data: AppData;
}

/** Counts used to describe a dataset to the user before overwriting anything. */
export interface DataSummary {
  clients: number;
  jobs: number;
  expenses: number;
  calendarBlocks: number;
}

export function summarise(data: AppData): DataSummary {
  return {
    clients: data.clients.length,
    jobs: data.jobs.length,
    expenses: data.expenses.length,
    calendarBlocks: data.calendarBlocks.length,
  };
}

export function describe(s: DataSummary): string {
  return `${s.clients} client${s.clients === 1 ? '' : 's'}, ${s.jobs} job${
    s.jobs === 1 ? '' : 's'
  }, ${s.expenses} expense${s.expenses === 1 ? '' : 's'}`;
}

export function backupFileName(): string {
  return `joinery-backup-${todayISO()}.json`;
}

/** Serialise the whole dataset into a downloadable backup file. */
export function exportBackup(data: AppData): void {
  const envelope: BackupEnvelope = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  a.click();
  URL.revokeObjectURL(url);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse a backup file back into a dataset.
 *
 * Accepts either the wrapped envelope written by exportBackup() or a bare
 * AppData object (handy for hand-built or migrated files). Throws a
 * user-readable Error on anything it can't vouch for — the caller is about to
 * replace real data with this, so silent coercion would be the wrong kindness.
 */
export function parseBackup(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isRecord(raw)) throw new Error("That file doesn't contain a dataset.");

  // Unwrap the envelope if present; otherwise treat the object as bare AppData.
  let body: Record<string, unknown> = raw;
  if (typeof raw.format === 'string') {
    if (raw.format !== FORMAT) {
      throw new Error(`That backup is from a different app (“${raw.format}”).`);
    }
    if (typeof raw.version === 'number' && raw.version > VERSION) {
      throw new Error(
        `That backup was written by a newer version of the app (v${raw.version}). Update first.`,
      );
    }
    if (!isRecord(raw.data)) throw new Error('That backup is missing its data.');
    body = raw.data;
  }

  const arrays = ['clients', 'jobs', 'expenses', 'calendarBlocks'] as const;
  for (const key of arrays) {
    if (body[key] !== undefined && !Array.isArray(body[key])) {
      throw new Error(`That backup's “${key}” section is malformed.`);
    }
  }
  // A file with none of the four sections is not a backup, it's just some JSON.
  if (arrays.every((key) => body[key] === undefined)) {
    throw new Error("That file doesn't look like a Joinery Tracker backup.");
  }

  const data = body as unknown as Partial<AppData>;
  return {
    clients: data.clients ?? [],
    jobs: data.jobs ?? [],
    expenses: data.expenses ?? [],
    calendarBlocks: data.calendarBlocks ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
  };
}
