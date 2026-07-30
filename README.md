# Joinery Jobs Tracker

A mobile-first React PWA to run a joinery business end-to-end — from first lead to
final profit. Built from the v2 build blueprint (`Joinery_Jobs_Tracker_Blueprint_v2.docx`).

## Modules

- **Dashboard** — effective day rate, active jobs, win rate, monthly income/profit,
  outstanding, 6-month income trend, effective £/day by category, next deadline, quick actions.
- **Clients** — directory with tap-to-call/email, source, notes, and auto-linked jobs.
- **Jobs** — board (by status pipeline) + list views, plus a full job record with collapsible
  sections: Measurements, Quote Breakdown, Stage Payments (with reconcile validation),
  Agreed Price, Time Tracking (hours/days, effective rate), Photos (before/during/after),
  Tasks, Final Actuals (profit), Rejection Reason, Notes. Duplicate-job supported.
- **Calendar** — month + list views; quote visits and task deadlines, prospective job blocks
  (tap to confirm), time off, and clash warnings by hours vs. daily capacity.
- **Finances** — all outgoings and all income (auto-pulled from received stage payments),
  outstanding balances, category totals, date filters, and full CSV export.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
```

The app is a PWA — open it on a phone and "Add to Home Screen".

## Data storage

**Local-first by default** — all data lives in your browser via `localStorage`, so the app
works with zero setup. Demo data is seeded on first run (clear or reload it from Settings).

### Switching to Supabase (cloud sync + photo storage)

The app talks to a storage abstraction (`src/lib/storage/`), so moving to the cloud is a config
change, not a rewrite.

Joinery shares one Supabase project with the life tracker, in a schema of its own (`joinery`,
beside `public` and `fitness`). The schema and its policies are in that repo, at
`Life-Tracker/supabase/migrations/0013_joinery_schema.sql`.

1. Run that migration in the Supabase dashboard's SQL editor.
2. **Project Settings → API → Exposed schemas** — add `joinery`. Without this every request 404s.
3. Copy `.env.example` to `.env`, set `VITE_DATA_BACKEND=supabase`, and fill in the project URL
   and anon key from **Project Settings → API**.
4. Restart the dev server, then create an account on the login screen (or sign in with the one
   you already use for the life tracker — it is the same auth).

Unlike the Firebase backend this replaced, the dataset is **relational**: eleven tables in the
`joinery` schema, one per list. `SupabaseRepository` decomposes `AppData` on save and recomposes
it on load, so no screen knows the difference — but joinery deadlines are now a SQL query, which
is what lets the life tracker's planner read them.

Saving rewrites your rows inside a single Postgres function (`joinery.save_state`), so a save
either lands completely or not at all.

Photos go to a **private** Storage bucket (`joinery-photos`) under `{user_id}/{job_id}/…`. What
is stored on the record is the object path; a signed URL is minted at load time. A public bucket
would have made every photograph of a client's home readable by anyone holding the link.

## Security

Every row carries a `user_id`, and a row-level security policy on it is the boundary — the
database returns nothing that isn't yours, whatever the front end asks for. There is no owner
allow-list any more and none is needed: another account signing in gets its own empty tracker,
not a rejection screen and not a glimpse of anyone else's clients, quotes or margins.

Photo objects are scoped the same way, by the user id in their path.

## Tech

- React 18 + TypeScript + Vite
- React Router (hash routing, PWA-friendly)
- `vite-plugin-pwa` for installability + offline caching
- `@supabase/supabase-js` (Postgres + Storage + email auth) for the optional cloud backend
- Plain CSS design system (`src/styles/global.css`) — deep-blue + amber, light/dark modes

## Responsive layout

One codebase, two structures. Below 900px it's a mobile app — bottom tab bar, single-column,
big tap targets. At 900px and up it becomes a desktop app — left sidebar nav, wider canvas
(max 1440px), multi-column dashboard, a horizontal kanban board for jobs, two-column job records,
and card-grid lists. It's a real layout switch, not a scaled-up phone view.

## Deploying to Vercel

The project is Vercel-ready (`vercel.json` sets the Vite build + SPA rewrite).

1. Push to **GitHub**, then on [vercel.com](https://vercel.com) → **Add New → Project** →
   import the repo. Vercel auto-detects Vite.
2. In the Vercel project's **Settings → Environment Variables**, add the same keys from your
   `.env` (the file itself is gitignored, so it is not uploaded):
   `VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. **Deploy**, then add the deployed URL under **Supabase → Authentication → URL Configuration →
   Redirect URLs** if you turn on email confirmation.

## Design

Deep blue (`#1E3A5F`) with amber (`#E8A020`) accents, large tap targets, collapsible detail
sections, traffic-light task priorities, and full light/dark theming — built for one-handed
on-site use.
