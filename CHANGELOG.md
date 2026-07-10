# Changelog

All notable changes to Meta Operations OS are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — CORTEX

### Design (approved, not yet implemented)
- `ARCHITECTURE.md` §22 documents **CORTEX**, the decision-making brain that consumes Contingency Core: Mission/Goal/Context/Strategy/Decision/Checklist/Validation/Knowledge Engines, organized around Missions rather than isolated event→response.
- Key design decision: a system-detected problem is a Mission (`origin: system`, `goal: recovery`), not a separate `incidents` table.
- Key design decision: Contingency Core owns structural/graph knowledge; CORTEX owns decisions and calls into Contingency Core for context, rather than maintaining its own view of the asset graph.
- No code, migrations, or UI for this domain yet — pending explicit go-ahead before implementation begins.

## [0.2.0] - 2026-07-10 — "Contingency Core"

Second module implemented in full: **Contingency Core**, answering the platform's core question — "if any asset disappeared today, would the operation keep running?" — with real, deterministic, rule-based engines (no LLM calls anywhere in this module).

### Added — Database
- Migration `20250101000010_contingency_core.sql`: `operational_architectures` table (name/description/country/product/environment/objective/status/continuity_score/health_score/last_audit_at), `checklists` table (`architecture_id` nullable FK, `items` jsonb `{key,label,done,done_at}`).
- `assets` gained `architecture_id` (nullable FK) and `role` (nullable text); `asset_types` gained `roles` (jsonb catalog), seeded for the 7 core types: Business Manager, Pixel, Ad Account, Profile, Virtual Machine, Domain, Page.
- `get_asset_impact(p_asset_id, p_max_depth)`: recursive SQL function for the real Relationship/Impact Engine — unlimited depth, bidirectional, cycle-safe via a `visited` array.
- RLS policies added for both new tables (dormant, per Single Operator Mode conventions), written idempotently (`drop ... if exists` guards on triggers/policies) so the migration is safely re-runnable.

### Added — API
- `GET/POST /api/architectures`, `GET/PATCH /api/architectures/[id]`.
- `GET /api/architectures/[id]/continuity` — runs the Continuity/Health/SPOF/Recovery-Readiness engines and persists the results back onto the architecture row.
- `GET /api/architectures/[id]/map` — nodes/edges for the Contingency Map.
- `GET/POST /api/architectures/[id]/checklist`, `PATCH /api/checklists/[id]/items/[key]`.
- `GET /api/assets/[id]/impact` — blast radius via `get_asset_impact()`, enriched with affected-asset detail and campaign/product/no-backup counts.
- `GET /api/assets/[id]/recovery-plan` — combines the Impact Engine with an auto-generated, ordered Recovery Plan.

### Added — Frontend
- `src/lib/contingency.ts`: pure, rule-based engines — `computeContinuity`, `computeArchitectureHealth`, `computeRecoveryReadiness`, `generateRecoveryPlan` — same determinism philosophy as `src/lib/scoring.ts`.
- `src/hooks/useArchitectures.ts`: `useArchitectures`, `useContinuity`, `useArchitectureMap`, `useChecklists`, `useFailureSimulation`.
- `src/pages/contingency/ContingencyCore.tsx` at new route `/contingency`, nav item in the Sidebar: architecture list + create modal, 4 tabs (Overview with scores/SPOF/readiness, Contingency Map, Failure Simulator, Checklist).
- `src/components/assets/AssetForm.tsx` gained Operational Architecture and Operational Role fields (role options filtered by the selected asset type's `roles` catalog).
- All new `contingency.*` and `assets.form.architecture`/`assets.form.role` strings added to `en.json`/`pt.json`/`es.json` in the same change.

### Fixed — found during migration apply, a real production bug
- **`ERROR 42P19: recursive reference to query "impact" must not appear within its non-recursive term`** when first applying the migration: `get_asset_impact()`'s original recursive CTE had three `union all` branches (base case, outbound join, inbound join) — Postgres only allows a `with recursive` block exactly one non-recursive term followed by exactly one recursive term, and the left-associated three-way union made the second recursive reference appear inside what Postgres treated as the non-recursive term. Fixed by combining both directions into a single recursive term via `join lateral (... union all ...) x on true`. Documented the rule in `CLAUDE.md` ("Recursive CTEs: one recursive term only") to prevent recurrence. Also made all trigger/policy creation in the migration idempotent (`drop ... if exists` guards) so a full re-run after a partial failure is always safe.

## [0.1.0] - 2026-07-10 — "Foundation + Asset Manager"

First official release. GitHub repository (`BlackKawa87/Meta-Operations-OS`) and Vercel project (`meta-operations-os`) created and connected; production deployment live at `https://meta-operations-os.vercel.app`; Supabase migrations applied to the production database.

### Added — Go Live
- Dedicated GitHub repository, initial commit, and a clean, isolated local Git history (separate from the developer's other unrelated repositories).
- Vercel project created and linked, connected to the GitHub repository, with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEFAULT_WORKSPACE_ID` configured as production environment variables.
- All 9 Supabase migrations applied to the production database (33 seeded asset types, default workspace, Storage bucket).

### Fixed — found during Go Live Validation, real production bugs
- **Vercel Functions failed at runtime with `FUNCTION_INVOCATION_FAILED`** on first deploy: `package.json` declares `"type": "module"`, so Vercel's Node runtime resolves relative imports as native ESM, which requires explicit `.js` extensions — our imports (written for Vite's bundler-mode resolution, which allows extensionless imports) didn't have them. Added `.js` to every relative import under `api/**`.
- A second build error surfaced once imports were fixed: `src/lib/scoring.ts` used the `@/types/database` path alias, which Vercel's per-function type-check doesn't resolve for files pulled in transitively (it's a Vite-only alias). Changed to a relative import.
- **Every dynamic `/api/assets/:id*` route (bare id, relationships, notes, documents, history, events, audit) silently returned `index.html` instead of JSON**, because `vercel.json`'s own rewrite rules were inserted ahead of Vercel's auto-generated dynamic API routes in the compiled routing config, and the SPA catch-all matched those paths first. Fixed by scoping the SPA fallback rewrite to exclude `/api/*` (`"/((?!api/).*)"`) instead of rewriting `/api/*` explicitly (which was redundant — Vercel routes to functions automatically). Verified by testing every affected endpoint directly against the live deployment after the fix.
- Along the way, also renamed `api/assets/[id]/index.ts` to `api/assets/[id].ts` (Vercel doesn't treat `dir/index.ts` as equivalent to `dir.ts` the way some frameworks do) — this alone didn't fix the routing issue, the `vercel.json` fix did, but it's the correct convention regardless.

### Validated
- Full end-to-end write path tested against production: created a test asset via `POST /api/assets`, confirmed automatic score computation, status history, event timeline, and audit log all fired correctly; verified in the browser (Dashboard, Asset Detail, all 8 tabs) with zero console errors in light and dark mode; archived the test asset afterward to leave the database in a clean state (0 assets).

## [Unreleased]

### Changed — Single Operator Mode cleanup and finalization
- Removed dead code and dead translation keys left over from the auth removal (unused `owner`/`table.owner`/`form.owner`/`uploadDocument` locale keys, unused `ALERT_TONE.noOwner`).
- Fixed a real bug: the "no owner" signal in scoring (`src/lib/scoring.ts`), risk alerts (`api/assets/risk.ts`), and summary counts (`api/assets/summary.ts`) permanently flagged every asset, since Single Operator Mode has no UI to assign `owner_id`. Removed the signal from all three; `owner_id` stays in the schema, dormant.
- Fixed a real bug: `RelationshipForm`'s notes input (Asset Detail → Relationships → Add relationship) was uncontrolled and never reached the submitted payload. Wired it up properly.
- Added missing loading states for every Asset Detail tab that fetches its own data (relationships, notes, documents, history, events, audit) — they previously flashed an empty state before data arrived.
- Added `aria-label`s to form controls without a visible label (note textarea, document file input, status/relationship selects).
- Rewrote `Settings` page copy to not mention any tenancy concept (previously said "companies and workspaces are dormant" in the UI, which violated Single Operator Mode's "no tenancy language on screen" rule).
- Removed the unused `globals` npm dependency (installed for an ESLint fix that a `config-protection` hook has blocked twice; documented as a known gap instead).
- Added `*.tsbuildinfo` to `.gitignore`.
- Rewrote `CLAUDE.md` as the project's full development guide: architecture decisions, Single Operator Mode rules, folder structure, naming, file/API/migration creation rules, React/TypeScript/Tailwind/Vercel Functions/Supabase/database/audit/logging conventions.
- Updated `README.md` with a features summary and refreshed known issues; updated `ARCHITECTURE.md`'s roadmap to mark Phase 0/1 complete and describe what's actually deferred to Phase 2 (Relationship Engine).

## Asset Manager Engine — Single Operator Mode migration

### Removed
- Supabase Auth entirely: login/signup UI, `AuthContext`, session/JWT handling, `requireUser` middleware, `api/_lib/auth.ts`.
- Workspace/company selection UI: `WorkspaceContext`, workspace switcher in the sidebar, `useWorkspaceMembers`, owner picker in the asset form, `api/workspaces/*` routes.
- Direct browser-to-Supabase-Storage upload (depended on a user JWT the app no longer has).

### Changed
- Every API route now uses a single service-role Supabase client (`getServiceClient()`) and a fixed `DEFAULT_WORKSPACE_ID` instead of resolving workspace/user per request.
- Document upload now goes through `POST /api/assets/[id]/documents` as base64 JSON; the server uploads to Storage via the service role.
- `src/lib/api.ts` no longer attaches an auth header, and now detects a non-JSON response (e.g. `vite dev`'s SPA fallback for unmatched `/api/*`) and raises a clear error instead of silently coercing to an empty object.
- Data hooks (`useAssets`, `useAssetTypes`, `useAssetSummary`, `useAssetRisk`) fall back to empty/null state instead of crashing when the API returns a malformed response.
- `App.tsx` no longer gates on authentication — it renders the Dashboard directly at `/`.

### Fixed
- A crash (`TypeError: Cannot read properties of undefined (reading 'map')`) on first load of the Dashboard once the login gate was removed, caused by API hooks not handling a missing `data` field defensively.

## Asset Manager Engine — initial build

### Added
- Full database schema (9 migrations): tenancy tables, generic `assets` table with JSONB `attributes`, `asset_types` catalog (33 types, seeded), support tables (`asset_notes`, `asset_documents`, `asset_relationships`, `asset_scores`, `asset_status_history`, `asset_events`), append-only `audit_logs` via `SECURITY DEFINER` trigger, RLS policies, Storage bucket + policies, auto-provisioning trigger (later replaced by the Single Operator Mode seed).
- Vercel Serverless API: asset CRUD + summary + risk, per-asset sub-resources (status, notes, documents, relationships, history, events, audit), asset type catalog, workspace/member listing (later removed).
- Frontend: Login/Signup, Sidebar + Header + workspace switcher (later removed), Asset Overview (Dashboard), Create/Edit Asset (dynamic form), Asset Detail (8 tabs), Asset Risk View, light/dark theme, English/Portuguese/Spanish localization.
- Rule-based scoring engine (`src/lib/scoring.ts`) computing health/risk/recovery/backup-coverage scores, recomputed synchronously on every relevant mutation.

## Architecture

### Added
- `ARCHITECTURE.md`: full target system design for Meta Operations OS — vision, philosophy, modules, entities, relationships, data flows, stack rationale, database schema, scalability, security, permissions, audit, event system, logging strategy, and a 7-phase technical roadmap.
