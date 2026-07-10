# Meta Operations OS — Asset Manager Engine

First module of Meta Operations OS, running in **Single Operator Mode**: no login, no signup, no workspace/company/user selection anywhere in the UI. The app opens straight into the Dashboard. See `ARCHITECTURE.md` for the full target system design and `CLAUDE.md` for development conventions. See `CHANGELOG.md` for what shipped when.

## What's implemented

**Asset Manager** — inventory and lifecycle management for every operational asset type (33 types: Business Managers, ad accounts, pixels, pages, profiles, VMs, proxies, and more):

- **Asset Overview** (Dashboard) — summary cards (total, active, at risk, blocked, no backup, critical), filters by type/status/criticality, search, sortable table.
- **Create / Edit Asset** — a single dynamic form driven by each asset type's field schema (no per-type hand-coded forms).
- **Asset Detail** — tabs for overview, direct relationships, risk & scores, notes, documents (upload), status history, event timeline, and audit log.
- **Asset Risk View** — cross-asset alerts (critical without backup, blocked-but-depended-on, undocumented, unrelated, problematic status).
- Rule-based scoring (health/risk/recovery/backup-coverage) recomputed synchronously on every relevant mutation.
- Append-only audit log via a `SECURITY DEFINER` Postgres trigger, independent from the per-asset event timeline.
- Full English/Portuguese/Spanish localization, light/dark theme.

Deliberately not built yet (see `ARCHITECTURE.md`'s roadmap): full Relationship Engine (recursive blast-radius), Health Engine as a scheduled job, Incident/Recovery/Playbook engines, AI Copilot, Automation Engine, and everything auth/multi-tenant (dormant by design in this phase — see `CLAUDE.md`'s "Single Operator Mode" section).

## Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 · Vercel Serverless Functions · Supabase (Postgres + Storage) · OpenAI (reserved for later modules).

## First-time setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   `.env.local` already has `SUPABASE_URL` and `DEFAULT_WORKSPACE_ID` filled in. You still need:

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=   # Supabase dashboard > Project Settings > API > service_role
   OPENAI_API_KEY=              # only needed once the AI Copilot module starts
   ```

3. **Link and push the database schema** (requires `supabase login` once):

   ```bash
   supabase login
   supabase link --project-ref oddubpmzczibpyuwlopt
   supabase db push
   ```

   This applies every file in `supabase/migrations/` in order: tenancy tables (provisioned, dormant), asset core, support tables (notes/documents/relationships/scores/events), audit triggers, RLS policies (dormant — the API uses the service-role key, which bypasses RLS), the 33-type asset catalog seed, the default workspace seed, and the Storage bucket.

4. **Regenerate real database types** (optional but recommended once linked):

   ```bash
   supabase gen types typescript --linked > src/types/database.ts
   ```

5. **Run the app**

   ```bash
   npm run dev
   ```

   It opens directly on the Asset Overview dashboard — no account needed. `npm run dev` only serves the frontend; plain Vite doesn't execute `/api/**` Vercel Functions, so data calls will fail with a clear "use vercel dev" error until you either run `vercel dev` (requires `vercel link` first) or deploy. Every screen degrades to an empty/error state rather than crashing when that happens.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b (src + api + node) then vite build
npm run lint      # ESLint (see known issue below)
npm run preview   # Preview production build
```

## Deploying

Push to GitHub, import the repo in Vercel, set env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEFAULT_WORKSPACE_ID`) in the Vercel project settings, and deploy — `/api/**` routes are picked up automatically as Serverless Functions.

**The app has no access control at all.** Anyone who reaches the deployed URL can use it — there's no login screen to bypass, there's simply nothing checking who's asking. Keep the deployment private (Vercel deployment protection, or don't share the URL) until multi-tenant auth is reactivated.

## Known issues

- `npm run lint` reports false-positive `no-undef` errors (`document`, `fetch`, `process`, DOM types) — `eslint.config.js` needs `globals` package wiring that a `config-protection` hook currently blocks editing. `tsc -b` and `vite build` are unaffected and are the authoritative correctness check in the meantime. Full detail and the fix in `CLAUDE.md`'s "Known gaps."
- `npm audit` reports vulnerabilities in transitive dev-only dependencies (`@vercel/node`, `vite`'s dev-only `esbuild`); fixing requires breaking major-version bumps, not applied here to avoid an unreviewed breaking change.
