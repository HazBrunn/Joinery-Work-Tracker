# Joinery: Firebase → Supabase

Brief for a fresh context window. Everything needed, nothing else.

## Goal

Move the joinery tracker off Firebase and into the `joinery` schema of the shared Supabase
project that already holds the life tracker (`public`) and training (`fitness`).

**There is no data to migrate.** The app has never been used for real work. This is a backend
replacement plus a schema design, not a data migration. Don't write a Firestore export path.

## What exists

- `C:\Users\esche\OneDrive\Desktop\Joinery Business Tracker` — Vite + React + **TypeScript**,
  `github.com/HazBrunn/Joinery-Work-Tracker`, deploys from `main` to Vercel.
- **Firebase**: one Firestore document at `app_state/main` holding `{ document: AppData }`, plus
  Firebase Storage for job photos under `job-photos/{jobId}/`. `firebase/firestore.rules` locks
  everything to one hard-coded Google UID.
- Auth is Google Sign-In through Firebase. This must become Supabase email/password auth, so
  that `auth.uid()` is Harris's Supabase user and RLS works.

### The data layer, which is the whole job

- `src/types.ts` — `AppData = { clients, jobs, expenses, calendarBlocks, settings }`. `Job` nests
  `measurements`, `quote { materials[], dayRate, estimatedHours }`, `stagePayments[]`,
  `timeEntries[]`, `photos[]`, `tasks[]` (`JobTask` has `deadline`, `category`, `priority`).
- `src/lib/storage/repository.ts` — the interface: `load()`, `save(AppData)`,
  `uploadImage(file, jobId)`, `backendName`. **Whole-document, not granular.**
- `src/lib/storage/index.ts` — picks the backend from `VITE_DATA_BACKEND`; falls back to
  `LocalRepository`.
- `src/store/DataContext.tsx` — holds all of `AppData` in React state. Screens call
  `update(draft => …)`, and a 250 ms debounce calls `repository.save(wholeDocument)`.
- Screens: `Dashboard`, `Clients`, `ClientDetail`, `Jobs`, `JobDetail` (923 lines), `Calendar`
  (565), `Finances` (326), `Settings`, `Login`.

## Recommended approach — read this before designing anything

Harris previously agreed to a "fully relational" schema, which was taken to mean rewriting
`DataContext` and every screen's write path into granular CRUD. **Don't do that.** There is a
better trade-off:

**Keep the `Repository` interface and `DataContext` exactly as they are. Write a
`SupabaseRepository` that decomposes `AppData` into relational tables on `save()` and
recomposes it on `load()`.**

- Real relational tables, so joinery deadlines can be queried in SQL and fed to the planner.
- **Zero changes to any screen.** `JobDetail.tsx` and the other 2,000-odd lines are untouched.
- Same pattern already proven in the life tracker: `Life-Tracker/src/tasks.js` does exactly this
  for tasks, and it made that migration cheap and low-risk. Read it before starting.

Cost: `save()` rewrites the user's rows rather than diffing. At one user and a few hundred rows
that is irrelevant, and a diff can be added later without touching the screens. Delete-and-insert
inside one transaction (a Postgres function, as with `fitness.import_plan`) keeps it atomic.

## Schema sketch

In schema `joinery`, every table with `user_id uuid not null references auth.users(id)`:

`clients`, `jobs`, `job_measurements`, `job_quote_materials`, `job_stage_payments`,
`job_time_entries`, `job_photos`, `job_tasks`, `expenses`, `calendar_blocks`, `settings`.

Keep the ids the app already generates (`src/lib/id.ts`) as text or uuid primary keys so
recomposition is a straight regroup by parent id. Enum-ish values (`JobStatus`, `TaskCategory`,
`Priority`, `ExpenseCategory`, `CalendarBlockType`) live in `src/types.ts` — mirror them as
`check` constraints.

Photos move to a Supabase Storage bucket; `uploadImage` returns its public or signed URL.

## Steps

1. Design the schema. Write it to `supabase/migrations/` **and** paste it as a copyable SQL block
   in chat — Harris runs it in the dashboard by hand.
2. Expose `joinery` in Supabase → Settings → API → Exposed schemas. Without this every request
   404s.
3. `grant usage on schema joinery to authenticated;` plus table grants. Policies are the boundary,
   grants only make PostgREST see it.
4. Write `SupabaseRepository`, add it to `createRepository()` behind
   `VITE_DATA_BACKEND=supabase`.
5. Replace Google Sign-In with Supabase auth in `Login.tsx`.
6. Storage bucket for photos, with policies scoped to `user_id`.
7. **The RLS gate — do this before entering any real client data.** Sign in as Escher
   (`escher964@gmail.com`, `8ffc043d-86c9-461e-9322-befc150b70a0`) and confirm zero joinery rows
   are reachable: through the client, through a direct PostgREST call, and through any RPC. Her
   account must never see client lists, quotes or margins. Harris is
   `d28fffe4-1f48-476b-ab2a-b10601b2bbc4`.
8. Only then retire Firebase.

## Gotchas that have already cost time on this project

- **No Supabase CLI, and Harris cannot open files.** All SQL must be pasted into chat as a
  copyable block. Keep a copy in `supabase/migrations/NNNN_name.sql` for the record.
- **`rls_auto_enable` already covers `joinery`.** An event trigger switches RLS on for any new
  table in `public`, `joinery` or `fitness`. It is a safety net, not a substitute — RLS with no
  policy is deny-all, which is safe but breaks the app. Write policies explicitly.
- **Never add `where x is not null` to a unique index you intend to upsert against.** A partial
  index cannot arbitrate `ON CONFLICT` unless the statement repeats the predicate. Nulls are
  distinct in a unique index anyway.
- **The Supabase SQL editor lints string literals.** A query that only *prints* SQL containing
  `insert into joinery.x` gets flagged, and choosing "Run and enable RLS" appends a real
  `alter table` that can fail. Pass schema names as `%I` format arguments.
- **Expect the destructive-query warning** on any `drop`, including `drop policy if exists`.
- **Use `security invoker`** on any Postgres function, so RLS still applies. A definer function
  is a hole straight through the only boundary between the two accounts.
- Joinery tables need `supabase.schema("joinery")` from the client, or set
  `{ db: { schema: 'joinery' } }` on `createClient` since this app only touches that schema.

## Planner integration (later, not part of this)

The life tracker's planner already reserves joinery: `Life-Tracker/src/ui/dayItem.jsx` has
`SOURCE.joinery` at `#7A5BB0` with a briefcase icon, and
`Life-Tracker/src/lib/dayPlan.js`'s `itemsForDay()` is the single place a new source is added —
both the planner and Today's focus then pick it up for free.

That seam is proven: household shared items were added through it as a fourth source
(`SOURCE.shared`) after the training sessions, with no change to either screen. Follow the same
shape for joinery — a loader, a `kind`, and a branch in `itemsForDay()`.

There is deliberately **no `plan_items` table**; the life tracker uses `public.tasks.planned_date`
and unions sources client-side. When joinery lands, whether to introduce `plan_items` becomes a
fair question again — it was skipped because two sources didn't justify it.

`user_features.joinery_enabled` is already `true` for Harris and absent (so false) for Escher.

## Working style

Ships straight to `main`, no preview branches. State risks once, plainly, then proceed — don't
gate. Concrete output over options.
