-- Single Operator Mode: no Supabase Auth, no signup flow, no memberships in
-- use. This seeds one fixed Company + Workspace with deterministic IDs so
-- the API layer (api/_lib/config.ts DEFAULT_WORKSPACE_ID) can reference it
-- without depending on auth.users existing at all.
--
-- The tenancy tables (companies, workspaces, teams, users_profile,
-- memberships) and their RLS policies are untouched and stay fully
-- multi-tenant-ready — see ARCHITECTURE.md "Single Operator Mode" note.
-- Reactivating multi-tenant later means: bring back Supabase Auth, the
-- login/signup UI, and an auto-provisioning trigger like the one this
-- file used to contain (see git history) — the schema doesn't need to change.

insert into companies (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Default Company', 'default')
on conflict (id) do nothing;

insert into workspaces (id, company_id, name, slug)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Main Workspace', 'main')
on conflict (id) do nothing;
