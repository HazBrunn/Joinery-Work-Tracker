// Supabase-backed repository.
//
// The app holds the whole dataset in memory and hands it back on every change,
// so this decomposes AppData into relational tables on save() and recomposes it
// on load(). Every screen is untouched — the Repository interface is the seam,
// exactly as public.tasks did it for the life tracker.
//
// save() rewrites the user's rows rather than diffing them, inside one
// Postgres function so it is all-or-nothing. At a few hundred rows that costs
// nothing worth measuring, and a diff can be added later without any screen
// knowing.
import {
  AppData, Client, Job, JobTask, Expense, CalendarBlock,
  Measurement, MaterialRow, StagePayment, TimeEntry, Photo,
  DEFAULT_SETTINGS, emptyData,
} from '../../types';
import { supabase, PHOTO_BUCKET } from '../supabase';
import { Repository } from './repository';

// Signed URLs expire, so what is stored is the object path and the signature is
// minted at load time. A week is long enough that an app left open stays
// working and short enough that a leaked URL stops working.
const SIGNED_TTL = 60 * 60 * 24 * 7;

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : undefined);
const num = (v: unknown, fallback = 0) => (v === null || v === undefined ? fallback : Number(v));

// A stored photo value is either a data URL (local backend, or legacy) or an
// object path in the bucket. Anything that isn't obviously a URL is a path.
const isPath = (v: string) => Boolean(v) && !v.startsWith('data:') && !v.startsWith('http');

// A signed URL carries its own path: .../object/sign/{bucket}/{path}?token=…
// Turning one back into a path is what lets a load-then-save round trip keep
// the path instead of persisting a URL that will expire.
function toStored(value: string): string {
  if (!value) return '';
  const marker = `/object/sign/${PHOTO_BUCKET}/`;
  const at = value.indexOf(marker);
  if (at === -1) return value;
  return decodeURIComponent(value.slice(at + marker.length).split('?')[0]);
}

export class SupabaseRepository implements Repository {
  readonly backendName = 'Supabase (cloud sync)';

  async load(): Promise<AppData> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    // No session means no rows are readable, which is not the same as there
    // being none. Throwing keeps the caller from seeding over real records.
    if (!me) throw new Error('You are signed out. Sign in again to reach your data.');

    const [clients, jobs, measurements, materials, stagePayments, timeEntries,
           photos, tasks, expenses, blocks, settings] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('jobs').select('*'),
      supabase.from('job_measurements').select('*').order('position'),
      supabase.from('job_quote_materials').select('*').order('position'),
      supabase.from('job_stage_payments').select('*').order('position'),
      supabase.from('job_time_entries').select('*').order('position'),
      supabase.from('job_photos').select('*').order('position'),
      supabase.from('job_tasks').select('*').order('position'),
      supabase.from('expenses').select('*'),
      supabase.from('calendar_blocks').select('*'),
      supabase.from('settings').select('*').maybeSingle(),
    ]);

    const failed = [clients, jobs, measurements, materials, stagePayments, timeEntries,
                    photos, tasks, expenses, blocks].find((r) => r.error);
    if (failed?.error) {
      console.error('Supabase load failed', failed.error);
      throw new Error('Could not reach your cloud data. Check your connection and try again.');
    }

    // A photo row holds an object path; the app wants something an <img> can
    // use. Signed in one batch rather than one call each.
    const photoRows = photos.data ?? [];
    const paths = photoRows.map((p) => p.url as string).filter(isPath);
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_TTL);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    const by = <T extends { job_id: string }>(rows: T[] | null) => {
      const m = new Map<string, T[]>();
      for (const r of rows ?? []) {
        const list = m.get(r.job_id) ?? [];
        list.push(r);
        m.set(r.job_id, list);
      }
      return m;
    };
    const mByJob = by(measurements.data), matByJob = by(materials.data), spByJob = by(stagePayments.data);
    const teByJob = by(timeEntries.data), phByJob = by(photos.data), tkByJob = by(tasks.data);

    const out: AppData = {
      clients: (clients.data ?? []).map((r): Client => ({
        id: r.id, fullName: r.full_name ?? '', address: r.address ?? '', phone: r.phone ?? '',
        email: r.email ?? '', source: r.source ?? '', notes: r.notes ?? '',
        createdAt: iso(r.created_at) ?? new Date().toISOString(),
      })),
      jobs: (jobs.data ?? []).map((r): Job => ({
        id: r.id, title: r.title ?? '', clientId: r.client_id ?? null, category: r.category ?? '',
        status: r.status, leadSource: r.lead_source ?? '',
        dateAdded: iso(r.date_added) ?? new Date().toISOString(),
        visitDate: iso(r.visit_date),
        measurements: (mByJob.get(r.id) ?? []).map((m): Measurement => ({ id: m.id, label: m.label ?? '', value: m.value ?? '' })),
        quote: {
          materials: (matByJob.get(r.id) ?? []).map((x): MaterialRow => ({
            id: x.id, item: x.item ?? '', quantity: num(x.quantity), unitCost: num(x.unit_cost),
          })),
          dayRate: num(r.quote_day_rate),
          estimatedHours: num(r.quote_estimated_hours),
        },
        stagePayments: (spByJob.get(r.id) ?? []).map((s): StagePayment => ({
          id: s.id, milestone: s.milestone ?? '', amount: num(s.amount),
          received: !!s.received, receivedDate: s.received_date ?? undefined,
        })),
        agreedPrice: r.agreed_price === null || r.agreed_price === undefined ? null : Number(r.agreed_price),
        timeEntries: (teByJob.get(r.id) ?? []).map((t): TimeEntry => ({
          id: t.id, description: t.description ?? '', hours: num(t.hours),
        })),
        photos: (phByJob.get(r.id) ?? []).map((p): Photo => ({
          id: p.id, group: p.photo_group, caption: p.caption ?? undefined,
          dataUrl: isPath(p.url) ? (signed.get(p.url) ?? '') : (p.url ?? ''),
        })),
        tasks: (tkByJob.get(r.id) ?? []).map((t): JobTask => ({
          id: t.id, title: t.title ?? '', category: t.category, priority: t.priority,
          deadline: iso(t.deadline), done: !!t.done, completedAt: iso(t.completed_at),
        })),
        rejectionReason: r.rejection_reason ?? undefined,
        notes: r.notes ?? '',
      })),
      expenses: (expenses.data ?? []).map((r): Expense => ({
        id: r.id, date: r.date ?? '', amount: num(r.amount), category: r.category,
        linkedJobId: r.linked_job_id ?? null, supplier: r.supplier ?? '',
        description: r.description ?? '', receiptDataUrl: r.receipt_url ?? undefined,
      })),
      calendarBlocks: (blocks.data ?? []).map((r): CalendarBlock => ({
        id: r.id, type: r.type, jobId: r.job_id ?? null, label: r.label ?? '',
        startDate: r.start_date ?? '', endDate: r.end_date ?? '', hours: num(r.hours),
      })),
      settings: settings.data
        ? {
            theme: settings.data.theme ?? DEFAULT_SETTINGS.theme,
            defaultDayRate: num(settings.data.default_day_rate, DEFAULT_SETTINGS.defaultDayRate),
            workingHoursPerDay: num(settings.data.working_hours_per_day, DEFAULT_SETTINGS.workingHoursPerDay),
            businessName: settings.data.business_name ?? DEFAULT_SETTINGS.businessName,
          }
        : { ...DEFAULT_SETTINGS },
    };

    // Genuinely nothing stored yet — the one case the caller may seed into.
    if (!out.clients.length && !out.jobs.length && !out.expenses.length && !out.calendarBlocks.length && !settings.data) {
      return { ...emptyData(), settings: out.settings };
    }
    return out;
  }

  async save(data: AppData): Promise<void> {
    // Photos go back as the path they came from, never as the signed URL the
    // screens have been showing — that would persist something with an expiry
    // date on it.
    const payload: AppData = {
      ...data,
      jobs: data.jobs.map((j) => ({
        ...j,
        photos: j.photos.map((p) => ({ ...p, dataUrl: toStored(p.dataUrl) })),
      })),
    };
    const { error } = await supabase.rpc('save_state', { p_doc: payload });
    if (error) console.error('Supabase save failed', error);
  }

  async uploadImage(file: File, jobId: string): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) throw new Error('Sign in again to upload photos.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // The first segment is the user id, which is what the bucket's policy checks.
    const path = `${me}/${jobId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: false });
    if (error) throw new Error('Could not upload that photo.');
    // Hand back something the screen can show now; save() turns it back into
    // the path before it is written.
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_TTL);
    return signed?.signedUrl ?? path;
  }
}
