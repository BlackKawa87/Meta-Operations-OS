# Changelog

All notable changes to Meta Operations OS are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

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
