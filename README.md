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

### Switching to Firebase (cloud sync + photo storage)

The app talks to a storage abstraction (`src/lib/storage/`), so moving to the cloud is a config
change, not a rewrite. In the [Firebase console](https://console.firebase.google.com/) for your
project:

1. **Firestore Database** → Create database (production mode). Then **Rules** → paste
   `firebase/firestore.rules` and Publish.
2. **Storage** → Get started. Then **Rules** → paste `firebase/storage.rules` and Publish.
   *(Storage requires the Blaze pay-as-you-go plan — only needed for photo uploads.)*
3. **Authentication** → Get started → enable the **Google** sign-in provider.
4. **Project settings → General → Your apps**: add a **Web app** (`</>`) if you haven't, then copy
   its config values.
5. Copy `.env.example` to `.env`, set `VITE_DATA_BACKEND=firebase`, and fill in the six
   `VITE_FIREBASE_*` values from that config.
6. Restart the dev server.

The dataset is stored as a single JSON document at `app_state/main` (immediate cross-device sync).
Photos are uploaded to **Firebase Storage** under `job-photos/{jobId}/…` and only their download
URL is kept in the document — this stays well under Firestore's 1 MiB document limit.

## Security

The app is locked to a single owner. Three layers enforce this:

| Layer | Where | What it does |
|-------|-------|-------------|
| **Google Sign-In** | App login screen | No anonymous access — must sign in with a Google account |
| **Owner UID gate** | `src/App.tsx` | Only the owner's Google account gets past the login; any other account sees a "No access" screen |
| **Firestore rule** | `firebase/firestore.rules` | Database physically rejects read/write from any UID other than the owner's |

### Setting up the owner UID

1. Deploy the app and sign in with your Google account.
2. Go to **Settings → Account** — your UID is shown there.
3. In the Firebase console → **Firestore → Rules**, make sure `firebase/firestore.rules` is
   published with your UID in the `request.auth.uid ==` check.
4. In `src/App.tsx`, the `OWNER_UID` constant is already set — update it if you ever need to
   change accounts. It can also be set via the `VITE_OWNER_UID` environment variable.

> **Your data is protected at the database level regardless of the front-end.** Even if someone
> bypasses the login screen, Firestore will reject their requests because they won't match the
> owner UID in the security rules.

## Tech

- React 18 + TypeScript + Vite
- React Router (hash routing, PWA-friendly)
- `vite-plugin-pwa` for installability + offline caching
- `firebase` (Firestore + Storage + Google Auth) for the optional cloud backend
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
   `VITE_DATA_BACKEND=firebase`, plus the six `VITE_FIREBASE_*` values.
3. **Deploy.** Then in the Firebase console:
   - **Authentication → Settings → Authorized domains** — add your `*.vercel.app` domain.
   - **Authentication → Sign-in method → Google** — enable it and set a support email.
4. Sign in to the live app, copy your UID from Settings → Account, and publish the Firestore
   rules with that UID to fully lock down the database.

## Design

Deep blue (`#1E3A5F`) with amber (`#E8A020`) accents, large tap targets, collapsible detail
sections, traffic-light task priorities, and full light/dark theming — built for one-handed
on-site use.
