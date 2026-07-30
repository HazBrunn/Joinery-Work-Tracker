// Naming a job so you can tell it from the other one like it.
//
// "Fitted Wardrobes" is not a job, it is a kind of job — there are three of
// them on the books. What identifies one is whose house it is in, so the client
// travels with the title wherever a job is listed or picked.
import { AppData, Job } from '../types';

/** "Sajjad Ali" → "SA". Falls back to the first two letters of a single name. */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function clientNameFor(data: AppData, job: Job | null | undefined): string {
  if (!job?.clientId) return '';
  return data.clients.find((c) => c.id === job.clientId)?.fullName ?? '';
}

/** Compact, for dropdowns and anywhere space is short: "SA — Fitted Wardrobes". */
export function jobLabel(data: AppData, job: Job): string {
  const ini = initials(clientNameFor(data, job));
  return ini ? `${ini} — ${job.title}` : job.title;
}

/** Full, for lists that have the room: "Fitted Wardrobes · Sajjad Ali". */
export function jobWithClient(data: AppData, job: Job | null | undefined): string {
  if (!job) return '';
  const name = clientNameFor(data, job);
  return name ? `${job.title} · ${name}` : job.title;
}
