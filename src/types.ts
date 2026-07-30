// ── Core domain types for Joinery Jobs Tracker ────────────────────────────────

export type JobStatus =
  | 'lead_in'
  | 'visit_booked'
  | 'quoted'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'rejected';

export const JOB_STATUSES: { value: JobStatus; label: string; icon: string; color: string }[] = [
  { value: 'lead_in', label: 'Lead In', icon: '📥', color: '#6B7A99' },
  { value: 'visit_booked', label: 'Visit Booked', icon: '📅', color: '#3E6FB0' },
  { value: 'quoted', label: 'Quoted', icon: '✏️', color: '#7A5BB0' },
  { value: 'accepted', label: 'Accepted', icon: '✅', color: '#1F9D6B' },
  { value: 'in_progress', label: 'In Progress', icon: '🔨', color: '#E8A020' },
  { value: 'completed', label: 'Completed', icon: '⭐', color: '#2E8B57' },
  { value: 'rejected', label: 'Rejected', icon: '✗', color: '#C0504D' },
];

// Job categories — seedable, but a sensible default list per the blueprint.
export const JOB_CATEGORIES = [
  'Fitted Wardrobes',
  'Alcove Units',
  'Kitchens',
  'Doors',
  'Flooring',
  'Shelving',
  'Bespoke Furniture',
  'Other',
];

export const LEAD_SOURCES = [
  'MyBuilder',
  'Word of Mouth',
  'Repeat Client',
  'Referral',
  'Website',
  'Other',
];

export type TaskCategory =
  | 'Quoting & Planning'
  | 'Preparation'
  | 'On-site Installation'
  | 'Admin';

export const TASK_CATEGORIES: TaskCategory[] = [
  'Quoting & Planning',
  'Preparation',
  'On-site Installation',
  'Admin',
];

export type Priority = 'red' | 'amber' | 'green';

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'red', label: 'Urgent', color: '#C0504D' },
  { value: 'amber', label: 'Soon', color: '#E8A020' },
  { value: 'green', label: 'Low', color: '#2E8B57' },
];

export type ExpenseCategory =
  | 'Materials'
  | 'Fuel'
  | 'Workshop'
  | 'Tools'
  | 'Subscriptions'
  | 'Leads'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Materials',
  'Fuel',
  'Workshop',
  'Tools',
  'Subscriptions',
  'Leads',
  'Other',
];

export type PhotoGroup = 'before' | 'during' | 'after';

// ── Entities ─────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  fullName: string;
  address: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
  createdAt: string; // ISO
}

export interface Measurement {
  id: string;
  label: string;
  value: string;
}

export interface MaterialRow {
  id: string;
  item: string;
  quantity: number;
  unitCost: number;
}

export interface Quote {
  materials: MaterialRow[];
  dayRate: number; // £ per day
  estimatedHours: number; // stored in hours
}

export interface StagePayment {
  id: string;
  milestone: string;
  amount: number;
  received: boolean;
  receivedDate?: string; // ISO date
}

export interface TimeEntry {
  id: string;
  description: string;
  hours: number; // always stored in hours
}

export interface Photo {
  id: string;
  group: PhotoGroup;
  dataUrl: string; // local: a data URL; supabase: a signed URL, stored as its object path
  caption?: string;
}

export interface JobTask {
  id: string;
  title: string;
  category: TaskCategory;
  priority: Priority;
  deadline?: string; // ISO datetime
  done: boolean;
  completedAt?: string;
}

export interface Job {
  id: string;
  title: string;
  clientId: string | null;
  category: string;
  status: JobStatus;
  leadSource: string;
  dateAdded: string; // ISO
  visitDate?: string; // ISO datetime — the booked quote visit

  measurements: Measurement[];
  quote: Quote;
  stagePayments: StagePayment[];
  agreedPrice: number | null;
  timeEntries: TimeEntry[];
  photos: Photo[];
  tasks: JobTask[];
  rejectionReason?: string;
  notes: string;
}

// Expenses live in Finances; the job's "Final Actuals" reads its linked expenses.
export interface Expense {
  id: string;
  date: string; // ISO date
  amount: number;
  category: ExpenseCategory;
  linkedJobId: string | null; // null = overhead
  supplier: string;
  description: string;
  receiptDataUrl?: string;
}

export type CalendarBlockType = 'prospective' | 'confirmed' | 'time_off';

export interface CalendarBlock {
  id: string;
  type: CalendarBlockType;
  jobId: string | null; // null for time off
  label: string;
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate: string; // ISO date inclusive
  hours: number; // planned hours across the block (capacity planning)
}

export interface Settings {
  theme: 'light' | 'dark';
  defaultDayRate: number; // £
  workingHoursPerDay: number; // capacity per day
  businessName: string;
}

export interface AppData {
  clients: Client[];
  jobs: Job[];
  expenses: Expense[];
  calendarBlocks: CalendarBlock[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  defaultDayRate: 275,
  workingHoursPerDay: 8,
  businessName: 'My Joinery',
};

export function emptyData(): AppData {
  return {
    clients: [],
    jobs: [],
    expenses: [],
    calendarBlocks: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function newQuote(dayRate: number): Quote {
  return { materials: [], dayRate, estimatedHours: 0 };
}
