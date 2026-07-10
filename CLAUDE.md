# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is the official development guide for this project — read it before making structural changes, and update it when you make a decision future work should follow.

## What this is

**Meta Operations OS** — an operational control system for Meta ecosystem assets (Business Managers, ad accounts, pixels, pages, profiles, VMs, proxies, etc.). Full target architecture and roadmap live in `ARCHITECTURE.md`. This repo currently implements the first module, **Asset Manager Engine**, running in **Single Operator Mode** (see below).

## Commands

```bash
npm run dev       # Vite dev server (frontend only — see note below)
npm run build     # tsc -b (src + api + node projects) && vite build
npm run lint      # ESLint (flat config; see "Known gaps")
npm run preview   # Preview production build
```

`npm run dev` runs plain Vite: it does **not** execute `/api/**` Vercel Functions. Unmatched requests fall back to `index.html` (200, `text/html`), which `src/lib/api.ts` detects and turns into a clear `ApiError` instead of a silent crash. To exercise API routes locally, use `vercel dev` (after `vercel link`) or test against a deployment.

Supabase (requires `supabase login` once, project ref `oddubpmzczibpyuwlopt`):

```bash
supabase link --project-ref oddubpmzczibpyuwlopt
supabase db push                                                 # apply supabase/migrations/*.sql, in order
supabase gen types typescript --linked > src/types/database.ts   # regenerate real types once linked
```

## Stack (fixed — do not propose alternatives)

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Vercel Serverless Functions (`/api/**`)
- **Database**: Supabase Postgres + Storage. Supabase Auth and RLS enforcement are provisioned but dormant — see Single Operator Mode.
- **AI**: OpenAI API (reserved for the future AI Copilot module — nothing calls it yet)
- **CI/CD**: GitHub + Vercel

## Single Operator Mode

The platform is used by one person right now. There is **no authentication, no login/signup UI, no workspace/company/user selection anywhere in the interface** — it must read like a single-operator desktop tool, not a multi-tenant SaaS. Concretely:

- `api/_lib/config.ts` exports `DEFAULT_WORKSPACE_ID`, a fixed constant every route uses instead of resolving a workspace from a JWT.
- `api/_lib/supabaseServer.ts` exposes only `getServiceClient()` (service-role key). There is no per-user/RLS-scoped client — RLS bypass is intentional here, not a bug.
- The tenancy tables (`companies`, `workspaces`, `teams`, `users_profile`, `memberships`) and their RLS policies (`20250101000006_rls.sql`) are **provisioned but unused** — this is what a future multi-tenant reactivation resolves per-request instead of reading a constant. **Do not delete them, do not "clean them up," do not add UI for them.**
- `supabase/migrations/20250101000008_default_workspace_seed.sql` seeds one Company + Workspace with fixed UUIDs matching `DEFAULT_WORKSPACE_ID`.
- Document uploads go through `POST /api/assets/[id]/documents` as base64 JSON (server uploads to Storage via service role) — there is no direct browser-to-Storage upload, because that would need a user JWT for Storage RLS that doesn't exist here.
- `owner_id` stays as a schema column (dormant) but is **not used in scoring, risk alerts, or summary counts** right now — there's no UI to assign it, so treating it as signal would flag every asset permanently with no way to resolve it. See the comment in `src/lib/scoring.ts`.
- UI copy must never say "workspace," "company," "tenant," "member," "team," or reference selecting a user — not even in Settings or empty-state text. If a screen needs to explain a dormant-mode limitation, phrase it around the *feature*, not the underlying entity.

**Reactivating multi-tenant later** means: bring back Supabase Auth + a login/signup UI + an `AuthContext`/`WorkspaceContext` (see git history for the previous versions, removed intentionally), swap `getServiceClient()` calls back to a JWT-scoped client in `api/_lib/*`, replace `DEFAULT_WORKSPACE_ID` reads with per-request resolution from the caller's membership, and bring back the owner picker + "no owner" signal. The schema needs no migration for this — it's already shaped for it.

## Architecture decisions

### Generic Asset + type-specific attributes (not one table per type)

Every operational entity (Pixel, Business Manager, Ad Account, VM, Proxy, ...) is a row in the single `assets` table (`supabase/migrations/20250101000003_assets.sql`), carrying fields common to every asset (status, criticality, owner, scores, workspace). Type-specific fields live in `assets.attributes` (jsonb), validated against the field schema declared in `asset_types.fields` for that row's `asset_type_id` (`20250101000002_asset_types.sql`, seeded in `20250101000007_seed_asset_types.sql`, 33 types). This is a deliberate deviation from `ARCHITECTURE.md`'s original "class-table inheritance" sketch: 33 near-empty extension tables would be more ceremony than value for a v1. It's why the Create/Edit form (`src/components/assets/AssetForm.tsx`) is fully data-driven instead of one hand-coded form per type.

`User`, `Team`, `Workspace` are **not** asset rows — they're tenancy entities. Don't add them to `asset_types`, even dormant.

### Relationships are direct-only (no graph engine yet)

`asset_relationships` is a directed graph edge table (`source_asset_id` → `target_asset_id`, typed by `relationship_type`). This module only exposes **direct** relationships (Asset Detail → Relationships tab). Recursive blast-radius traversal is the Relationship Engine, a later module — check `ARCHITECTURE.md` §20 before building that here.

### Scores recompute synchronously, not on a schedule

`src/lib/scoring.ts` (`computeAssetScores`) is a pure, rule-based function (health/risk/recovery/backup-coverage/criticality). `api/_lib/recompute.ts` calls it and persists both the denormalized current values on `assets` and a history row in `asset_scores`, run synchronously after every mutation that could affect it (status change, note/document added, relationship added/removed). The full Health Engine (weighted history, incident correlation, scheduled recomputation) is a later phase.

### Security model

RLS policies exist (`20250101000006_rls.sql`) and stay dormant — they're not the active security boundary right now because there's no per-user JWT to scope by. There is **no access control on the deployed app**: keep deployments private (Vercel deployment protection, or don't share the URL) until multi-tenant auth is reactivated. `audit_logs` is append-only, written exclusively by a `SECURITY DEFINER` trigger (`20250101000005_audit.sql`); no app role has insert/update/delete policies on it — don't add one.

## Folder structure

```
api/                          Vercel Serverless Functions (one file = one route, file-based routing)
  _lib/                        shared server-only helpers (not routes — prefixed with _ so Vercel skips them)
  assets/                      /api/assets/**
  asset-types/                 /api/asset-types
src/
  components/
    ui/                        generic, domain-agnostic primitives (Button, Card, Modal, ...)
    layout/                    app shell (Sidebar, Header, AppLayout)
    assets/                    domain components tied to the Asset Manager (AssetForm, ...)
  contexts/                    React context providers (currently just ThemeContext)
  hooks/                       data-fetching hooks, one per resource area (useAsset, useAssets, useAssetTypes)
  lib/                         framework-agnostic helpers (api client, i18n setup, scoring, validation)
  locales/                     en.json / pt.json / es.json — flat-ish nested translation trees
  pages/                       one file per route, composed from hooks + components
  types/                       hand-written types mirroring the DB schema
supabase/migrations/           numbered, sequential, applied in order by `supabase db push`
```

## Development workflow

1. Read `ARCHITECTURE.md` for anything that touches data model or module boundaries; read this file for conventions.
2. Prefer editing an existing file in the right layer over creating a new one — see "Rules for creating files" below.
3. After any change: `npx tsc -b --pretty false` (must be 0 errors — `noUnusedLocals`/`noUnusedParameters` are on, so unused imports fail the build, not just lint) then `npm run build`.
4. If the change touches a screen, actually look at it (`npm run dev`, or `vercel dev` if it needs `/api/**`) in light and dark mode before calling it done.
5. Don't leave `console.log`, commented-out code, or TODO markers in committed code. If something is genuinely deferred, it belongs in `ARCHITECTURE.md`'s roadmap or this file's "Known gaps," not a code comment.

## Naming

- Files: `PascalCase.tsx` for components/pages, `camelCase.ts` for hooks/lib/utils, `useX.ts` for hooks.
- React components and their file: one component per file, file name matches the exported component name.
- DB: `snake_case` for every table and column, plural table names (`assets`, `asset_notes`), singular for join/edge tables named after the relationship (`asset_relationships`).
- API routes: REST-ish nesting mirrors the DB relationship (`/api/assets/[id]/notes`), plural resource segments.
- i18n keys: `camelCase`, grouped by screen/feature (`assets.detail.noNotes`), never a raw literal ID.
- Booleans: `is`/`has` prefix (`hasBackupCoverage`, `isArchived`) in TS; DB uses bare adjectives or `_at` timestamps for state (`archived_at`, not `is_archived`) since "when" is more useful than "whether" for an audit-heavy system.

## Rules for creating files

- **New UI primitive** → `src/components/ui/`, must be domain-agnostic (no `Asset`-specific logic). If it needs domain knowledge, it belongs in `src/components/assets/` (or a future `src/components/<domain>/`) instead.
- **New screen** → `src/pages/<domain>/Name.tsx`, register the route in `src/App.tsx`. Pages compose hooks + components; they don't call `fetch`/`api` directly.
- **New data hook** → `src/hooks/use<Resource>.ts`. Return shape is always `{ data (renamed to the resource name), loading, error, refetch }` for reads, plus named mutator functions for writes (`addNote`, not a generic `mutate`).
- **New shared server helper** → `api/_lib/`, prefixed so Vercel doesn't treat it as a route.
- **New translation string** → add the key to all three of `en.json`/`pt.json`/`es.json` in the same commit. Never ship a key in one locale only.

## Rules for creating APIs

- One file per route; nested dynamic segments follow Vercel's `[param]` folder convention.
- Every handler starts with `methodGuard(req, res, [...])` (from `api/_lib/http.ts`) before touching anything else.
- Every handler gets its Supabase client via `getServiceClient()` (from `api/_lib/supabaseServer.ts`) — never construct a client inline.
- Validate every request body with a `zod` schema from `src/lib/validation/*` (shared with the frontend form that produces the payload) — never trust `req.body` shape directly.
- Wrap the handler body in `try { ... } catch (err) { return sendError(res, err); }`; throw `HttpError(status, message)` for expected failure cases (404, 400), let unexpected errors fall through to `sendError`'s generic 500.
- Any mutation that changes an asset's derived state (status, notes, documents, relationships) calls `recomputeAssetScores` (from `api/_lib/recompute.ts`) before responding.
- Any mutation worth remembering emits a row to `asset_events` (see "Audit and events conventions" below) in the same handler, not via a trigger.

## Rules for migrations

- One numbered file per logical change, `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, timestamps strictly increasing — never edit an already-applied migration, add a new one.
- Every table gets: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, and (where the table represents a mutable, owned resource) `updated_at` + a `set_updated_at()` trigger, `created_by`/`updated_by` referencing `auth.users(id)` (nullable — no rows exist in Single Operator Mode, that's fine).
- Every table scoped to a tenant gets `workspace_id uuid not null references workspaces(id) on delete cascade`, indexed, and an RLS policy pair (`_select`/`_insert`/`_update`/`_delete` as applicable) even though enforcement is currently dormant — write it as if auth were live.
- Constrain enums with a `check (col in (...))`, not a Postgres `enum` type — enums are painful to extend later; a `check` constraint is one migration to alter.
- Never hard-delete a business record from application code; add `archived_at timestamptz` for soft delete instead. Hard `DELETE` is reserved for pure edge rows (a relationship, a note) that have no downstream references.

## React component patterns

- Function components only, named exports (`export function Foo()`), no default exports except `App.tsx` (required by the router entry point) and page-level lazy-loaded components (none yet).
- Props typed with an inline `interface ComponentNameProps` above the component, not inlined in the function signature, once there are more than ~2 props.
- No prop drilling workarounds via context for things that are just page-local state — `ThemeContext` exists because theme is genuinely global; don't add another context for something one page owns.
- Conditional rendering order in data screens is always: `loading` → `error` → `empty` → data. Every screen that fetches must render all four states (see `src/components/ui/States.tsx`: `LoadingState`, `ErrorState`, `EmptyState`).
- Forms are uncontrolled-free: every input is controlled (`value` + `onChange`), even ones that look decorative — an input with no `value`/`onChange` wired to submission state is a bug, not a placeholder (this was found and fixed once already in `RelationshipForm`; don't reintroduce it).
- Every interactive element that has no visible text label (icon-only buttons, selects without a `<label>`) gets an `aria-label`.

## TypeScript patterns

- `strict`, `noUnusedLocals`, `noUnusedParameters` are on in every tsconfig (`app`, `node`, `api`) — treat a red build as the source of truth for dead imports, not a linter.
- Row types in `src/types/database.ts` are hand-written to mirror the migrations exactly; when a migration changes a table shape, update this file in the same change. Once the project is linked, prefer regenerating via `supabase gen types typescript --linked` and reconciling.
- Supabase clients (`supabase-js`) are **not** parameterized with the `Database` generic — postgrest-js's expected generic shape has changed across versions and hand-matching it is brittle (see the comment in `src/lib/api.ts`/`api/_lib/supabaseServer.ts`). Cast `.select()` results to the row types from `@/types/database` at the call site instead of fighting the client's generics.
- Shared request/response shapes (zod schemas + their inferred types) live in `src/lib/validation/*` and are imported by both the API route and the form that produces the payload — one source of truth, not a duplicated interface on each side.

## Tailwind patterns

- Tailwind v4, configured via `@tailwindcss/vite` — there is no `tailwind.config.js`; design tokens live in `src/index.css`'s `@theme` block.
- Color usage: semantic CSS variables (`--bg-page`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-subtle`, `--border-default`) for anything that must adapt between light/dark — reference them as `text-[var(--text-primary)]`, never a raw Tailwind gray/slate shade for primary UI chrome. Semantic accent colors (`brand`, `success`, `warning`, `danger`, `info`) are real Tailwind theme colors and are fine to use directly (`text-danger-500`) since they're defined with dark-mode-aware pairs already.
- Dark mode is class-based (`@custom-variant dark (&:where(.dark, .dark *));`), toggled by `ThemeContext` adding/removing `.dark` on `<html>`. Don't rely on `prefers-color-scheme` alone — the toggle must work regardless of OS setting.
- Responsive breakpoints: mobile-first, `md:` is the primary desktop breakpoint used throughout (sidebar becomes a drawer below `md`, grids collapse to fewer columns). Stay consistent with `md:` as *the* breakpoint rather than introducing `lg:`/`xl:` ad hoc unless a specific layout genuinely needs a third tier.

## Vercel Functions patterns

- Runtime: Node (`@vercel/node` types), one default-exported `handler(req, res)` per file.
- No middleware chain — each handler is self-contained (methodGuard → service client → validate → do the thing → respond). If two routes need the exact same non-trivial logic, extract it to `api/_lib/`, don't build a middleware abstraction for two call sites.
- Body size: default Vercel serverless body limit applies (~4.5MB); the one route that needs more headroom (`documents.ts`, base64 file uploads) sets `export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }` explicitly — do the same for any future route handling inline file payloads.

## Supabase conventions

- Server-side: always `getServiceClient()`. There is currently no scenario in this codebase that should use a user-scoped client (no users exist).
- Storage: the `asset-documents` bucket is private; objects are keyed `{workspace_id}/{asset_id}/{timestamp}-{filename}`. Uploads happen server-side via the service client, never a signed client-side upload, while Single Operator Mode has no JWT to authorize one.
- Auth: not initialized anywhere in this codebase. Don't import `@supabase/supabase-js`'s auth helpers on the frontend — there is no `src/lib/supabaseClient.ts` (removed on purpose); the frontend only ever calls `/api/**` via `src/lib/api.ts`.

## Database conventions

- `workspace_id` on every asset-scoped table, even though it's currently always `DEFAULT_WORKSPACE_ID` — this is what makes reactivating multi-tenant a data-migration-free flip.
- Current-state columns are denormalized onto `assets` (e.g. `health_score`) *and* appended to a history table (`asset_scores`) on every recompute — read the fast denormalized column, never recompute history at read time.
- Status is a `check`-constrained `text`, not an enum type (see "Rules for migrations"). The canonical list of valid values lives in exactly one place in application code: `ASSET_STATUSES` in `src/lib/validation/asset.ts` — keep the migration's `check` constraint and this array in sync by hand when either changes.

## Audit and events conventions

Two distinct logs exist, don't conflate them:

- **`audit_logs`** — system-of-record for "who changed what," append-only, written exclusively by the `SECURITY DEFINER` trigger `log_asset_audit()` on `assets`/`asset_relationships`/`asset_notes`/`asset_documents`/`memberships`. Never insert into this table from application code.
- **`asset_events`** — domain-level activity feed for a specific asset (`asset.created`, `asset.status_changed`, `relationship.created`, ...), written explicitly by API route handlers alongside the mutation, shown in the Asset Detail "Events" tab. When adding a new mutation type, add a matching `event_type` here rather than only relying on `audit_logs` — they serve different UI surfaces (raw diff vs. human-readable timeline).

## Logging conventions

- No `console.log` in committed code, ever — if you need it while debugging, remove it before finishing the change (this was violated once during a live debugging session; the cleanup pass removed it).
- Server-side errors: `sendError()` (`api/_lib/http.ts`) logs unexpected (non-`HttpError`) exceptions via `console.error` and returns a generic 500 — don't leak internal error messages to the client for anything that isn't an intentional `HttpError`.
- User-facing operational history (what happened to an asset) belongs in `asset_events`/`audit_logs`, not in application logs — logs are for debugging the system, the event/audit tables are the product's own record and are what the UI reads.

## i18n

Default locale is English; Portuguese and Spanish are also supported (`src/locales/{en,pt,es}.json`, loaded via `react-i18next` in `src/lib/i18n.ts`). Every new user-facing string needs an entry in all three files in the same change, plus (for asset type/field labels, which are data not UI strings) `label_en`/`label_pt`/`label_es` columns rather than a translation-file key.

## Known gaps

- `eslint.config.js` is missing `globals` (browser/node) wiring, so `npm run lint` will flag false-positive `no-undef` for `document`/`fetch`/`process`/DOM types. A `config-protection` hook blocks editing that specific file from within a Claude Code session (confirmed twice, no env-var bypass exists for it, unlike GateGuard). `tsc -b` and `vite build` are unaffected and are the authoritative correctness check until this is fixed by someone editing the file directly or disabling the hook. The `globals` npm package was removed from `package.json` since it can't be wired in — reinstall it (`npm install -D globals`) when you do fix this.
- `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY` are blank in `.env.local` — fill in before deploying or touching the (not-yet-built) AI Copilot module.
- Known npm audit findings are all in transitive dev-only dependencies (`@vercel/node`'s dependency tree, `vite`'s dev-server-only `esbuild`) and require breaking major-version bumps to clear (`vite@8`, `@vercel/node@5`) — not fixed here to avoid an unreviewed breaking change; revisit deliberately, not via `npm audit fix --force` in passing.
