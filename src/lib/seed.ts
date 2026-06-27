// Demo data — gives a realistic, populated app on first run. Users can clear it
// from Settings. Dates are generated relative to "today" so it always looks current.
import { AppData, Job, newQuote } from '../types';
import { uid } from './id';
import { dateKey } from './format';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function dateTimeFromNow(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function seedData(): AppData {
  const c1 = uid();
  const c2 = uid();
  const c3 = uid();

  const clients = [
    {
      id: c1,
      fullName: 'Sarah & Tom Whitfield',
      address: '14 Elm Crescent, Bristol BS6 7QP',
      phone: '07700 900145',
      email: 'sarah.whitfield@example.com',
      source: 'MyBuilder',
      notes: 'Side gate code 4471. Prefers texts over calls.',
      createdAt: daysFromNow(-40),
    },
    {
      id: c2,
      fullName: 'Daniel Okafor',
      address: '3 Maple Court, Bath BA2 4LL',
      phone: '07700 900284',
      email: 'd.okafor@example.com',
      source: 'Word of Mouth',
      notes: 'Repeat customer — did his study shelving last year.',
      createdAt: daysFromNow(-90),
    },
    {
      id: c3,
      fullName: 'Priya Raman',
      address: '88 Station Road, Bristol BS3 1QT',
      phone: '07700 900512',
      email: 'priya.raman@example.com',
      source: 'Referral',
      notes: 'Referred by Daniel Okafor.',
      createdAt: daysFromNow(-12),
    },
  ];

  // Job 1 — completed fitted wardrobes (full lifecycle, profitable).
  const job1: Job = {
    id: uid(),
    title: 'Master bedroom fitted wardrobes',
    clientId: c1,
    category: 'Fitted Wardrobes',
    status: 'completed',
    leadSource: 'MyBuilder',
    dateAdded: daysFromNow(-38),
    visitDate: dateTimeFromNow(-35, 10),
    measurements: [
      { id: uid(), label: 'Alcove width', value: '2,440mm' },
      { id: uid(), label: 'Floor to ceiling', value: '2,390mm' },
      { id: uid(), label: 'Depth available', value: '600mm' },
    ],
    quote: {
      ...newQuote(275),
      materials: [
        { id: uid(), item: '18mm MDF sheets', quantity: 6, unitCost: 42 },
        { id: uid(), item: 'Soft-close hinges (pairs)', quantity: 8, unitCost: 6.5 },
        { id: uid(), item: 'Hanging rails + brackets', quantity: 3, unitCost: 18 },
        { id: uid(), item: 'Paint & primer', quantity: 1, unitCost: 85 },
      ],
      estimatedHours: 40,
    },
    stagePayments: [
      { id: uid(), milestone: 'Deposit on acceptance', amount: 900, received: true, receivedDate: daysFromNow(-30) },
      { id: uid(), milestone: '50% on material delivery', amount: 1350, received: true, receivedDate: daysFromNow(-18) },
      { id: uid(), milestone: 'Balance on completion', amount: 450, received: true, receivedDate: daysFromNow(-6) },
    ],
    agreedPrice: 2700,
    timeEntries: [
      { id: uid(), description: 'Quoting & planning', hours: 4 },
      { id: uid(), description: 'Workshop prep & cutting', hours: 16 },
      { id: uid(), description: 'On-site install (day 1)', hours: 8 },
      { id: uid(), description: 'On-site install (day 2)', hours: 9 },
      { id: uid(), description: 'Snagging & paint', hours: 5 },
    ],
    photos: [],
    tasks: [
      { id: uid(), title: 'Order MDF from supplier', category: 'Preparation', priority: 'amber', deadline: dateTimeFromNow(-24, 9), done: true, completedAt: daysFromNow(-25) },
      { id: uid(), title: 'Final snag walkthrough', category: 'On-site Installation', priority: 'green', deadline: dateTimeFromNow(-6, 16), done: true, completedAt: daysFromNow(-6) },
    ],
    notes: 'Client thrilled with the result — asked for a quote on the spare room next.',
  };

  // Job 2 — in progress kitchen (active, partly paid).
  const job2: Job = {
    id: uid(),
    title: 'Shaker kitchen units & worktop fit',
    clientId: c2,
    category: 'Kitchens',
    status: 'in_progress',
    leadSource: 'Word of Mouth',
    dateAdded: daysFromNow(-20),
    visitDate: dateTimeFromNow(-18, 14),
    measurements: [
      { id: uid(), label: 'Run A length', value: '3,100mm' },
      { id: uid(), label: 'Run B length', value: '1,800mm' },
    ],
    quote: {
      ...newQuote(300),
      materials: [
        { id: uid(), item: 'Carcass units', quantity: 9, unitCost: 65 },
        { id: uid(), item: 'Shaker door fronts', quantity: 14, unitCost: 38 },
        { id: uid(), item: 'Solid oak worktop (3m)', quantity: 2, unitCost: 240 },
        { id: uid(), item: 'Handles & fixings', quantity: 1, unitCost: 120 },
      ],
      estimatedHours: 56,
    },
    stagePayments: [
      { id: uid(), milestone: 'Deposit on acceptance', amount: 1800, received: true, receivedDate: daysFromNow(-15) },
      { id: uid(), milestone: '40% on delivery', amount: 1800, received: true, receivedDate: daysFromNow(-4) },
      { id: uid(), milestone: 'Balance on completion', amount: 900, received: false },
    ],
    agreedPrice: 4500,
    timeEntries: [
      { id: uid(), description: 'Quoting & planning', hours: 5 },
      { id: uid(), description: 'Workshop prep', hours: 12 },
      { id: uid(), description: 'On-site install (day 1)', hours: 8 },
    ],
    photos: [],
    tasks: [
      { id: uid(), title: 'Template worktop for cuts', category: 'Preparation', priority: 'red', deadline: dateTimeFromNow(1, 9), done: false },
      { id: uid(), title: 'Fit & oil worktop', category: 'On-site Installation', priority: 'amber', deadline: dateTimeFromNow(3, 9), done: false },
      { id: uid(), title: 'Send final invoice', category: 'Admin', priority: 'green', deadline: dateTimeFromNow(6, 17), done: false },
    ],
    notes: 'Worktop oiling needs two coats, 24h apart — plan the visits accordingly.',
  };

  // Job 3 — quoted, awaiting decision.
  const job3: Job = {
    id: uid(),
    title: 'Under-stairs storage & shelving',
    clientId: c3,
    category: 'Bespoke Furniture',
    status: 'quoted',
    leadSource: 'Referral',
    dateAdded: daysFromNow(-8),
    visitDate: dateTimeFromNow(-5, 11),
    measurements: [
      { id: uid(), label: 'Stair run width', value: '900mm' },
      { id: uid(), label: 'Max height', value: '1,950mm' },
    ],
    quote: {
      ...newQuote(275),
      materials: [
        { id: uid(), item: '18mm birch ply', quantity: 4, unitCost: 58 },
        { id: uid(), item: 'Push-catch hardware', quantity: 5, unitCost: 9 },
      ],
      estimatedHours: 24,
    },
    stagePayments: [],
    agreedPrice: null,
    timeEntries: [{ id: uid(), description: 'Site visit & quoting', hours: 3 }],
    photos: [],
    tasks: [
      { id: uid(), title: 'Chase quote with Priya', category: 'Admin', priority: 'amber', deadline: dateTimeFromNow(2, 10), done: false },
    ],
    notes: '',
  };

  // Job 4 — a rejected job, for win-rate + rejection insight.
  const job4: Job = {
    id: uid(),
    title: 'Internal oak door hanging x4',
    clientId: c1,
    category: 'Doors',
    status: 'rejected',
    leadSource: 'MyBuilder',
    dateAdded: daysFromNow(-30),
    measurements: [],
    quote: {
      ...newQuote(275),
      materials: [{ id: uid(), item: 'Oak doors', quantity: 4, unitCost: 110 }],
      estimatedHours: 12,
    },
    stagePayments: [],
    agreedPrice: null,
    timeEntries: [],
    photos: [],
    tasks: [],
    rejectionReason: 'Lost to a competitor — client said our price was about £150 higher.',
    notes: '',
  };

  const jobs = [job1, job2, job3, job4];

  const expenses = [
    { id: uid(), date: daysFromNow(-28), amount: 380, category: 'Materials' as const, linkedJobId: job1.id, supplier: 'Howdens', description: 'MDF, hinges, rails', receiptDataUrl: undefined },
    { id: uid(), date: daysFromNow(-6), amount: 85, category: 'Materials' as const, linkedJobId: job1.id, supplier: 'Brewers', description: 'Paint & primer', receiptDataUrl: undefined },
    { id: uid(), date: daysFromNow(-14), amount: 1240, category: 'Materials' as const, linkedJobId: job2.id, supplier: 'Howdens', description: 'Carcasses, fronts, worktop', receiptDataUrl: undefined },
    { id: uid(), date: daysFromNow(-3), amount: 42, category: 'Fuel' as const, linkedJobId: null, supplier: 'Shell', description: 'Van diesel', receiptDataUrl: undefined },
    { id: uid(), date: daysFromNow(-7), amount: 27.5, category: 'Leads' as const, linkedJobId: null, supplier: 'MyBuilder', description: 'Weekly lead charges', receiptDataUrl: undefined },
    { id: uid(), date: daysFromNow(-2), amount: 19.99, category: 'Subscriptions' as const, linkedJobId: null, supplier: 'Adobe', description: 'PDF tools', receiptDataUrl: undefined },
  ];

  const calendarBlocks = [
    { id: uid(), type: 'confirmed' as const, jobId: job2.id, label: 'Kitchen install', startDate: daysFromNow(1), endDate: daysFromNow(3), hours: 24 },
    { id: uid(), type: 'prospective' as const, jobId: job3.id, label: 'Under-stairs build (provisional)', startDate: daysFromNow(12), endDate: daysFromNow(14), hours: 24 },
    { id: uid(), type: 'time_off' as const, jobId: null, label: 'Long weekend', startDate: daysFromNow(8), endDate: daysFromNow(9), hours: 0 },
  ];

  return {
    clients,
    jobs,
    expenses,
    calendarBlocks,
    settings: {
      theme: 'light',
      defaultDayRate: 275,
      workingHoursPerDay: 8,
      businessName: 'My Joinery',
    },
  };
}
