# GARV Market Movement Trends

Competitive movement dashboard for Great American RV — units, market share, and
movement vs. the state trend against competitor dealer groups, per market / per
store / company, broken out by **Motors**, **Towables**, and **All**. Monthly
snapshots are captured and compared month-to-month.

## Stack
- React + Vite SPA (Recharts), GARV design system.
- Netlify Functions + **Netlify Blobs** for month snapshots (`netlify/functions/snapshots.mjs`).
- SheetJS parsing shared by the in-browser uploader and the local seed script.

## Monthly workflow
Each month you have three inputs (same format every time):
1. `2026 TOTAL BUDGET COMPANY WORKBOOK.xlsx` — our numbers (store tabs, ACTUAL new units, Used excluded).
2. `<STORE> Market Comparison <Month> <Year>.xlsx` — one per store, competitor registrations.
3. `State Trend.xlsx` — per-state YoY growth.

Click **↑ Upload month** in the app and drop all of them. Everything is parsed
in the browser and the snapshot is stored server-side. The store list, competitor
groups/rooftops, and states are all discovered from the files — no code edits to
add a store, competitor, or state (`MEM` is the one intentional exclusion).

## Admin
The **⚙ Admin** panel clears data (one month, or all) and is gated by a password
enforced server-side. Set it in Netlify → Site settings → Environment variables:

```
ADMIN_PASSWORD = <your password>
```

Without it, delete requests are refused.

## Develop
```bash
npm install
npm run seed        # build public/data/<period>.json from .xlsx files in the repo root (local only)
npm run dev         # http://localhost:5178
npm run build       # -> dist/
```
`vite dev` has no Functions/Blobs runtime, so Upload and Admin actions only work
on the deployed Netlify site; the seed JSON lets the dashboard render locally.

## Deploy
Connect the repo to Netlify (build `npm run build`, publish `dist`, functions
`netlify/functions` — see `netlify.toml`), then add `ADMIN_PASSWORD`. Upload the
first month from the live site.
