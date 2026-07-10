// Single Operator Mode: the app always operates against one fixed
// Company/Workspace (seeded by supabase/migrations/20250101000008_default_workspace_seed.sql)
// instead of resolving it per-request from a JWT/membership. Reactivating
// multi-tenant later means resolving this per-authenticated-user again
// instead of reading a constant — see ARCHITECTURE.md "Single Operator Mode".
export const DEFAULT_WORKSPACE_ID =
  process.env.DEFAULT_WORKSPACE_ID ?? '00000000-0000-0000-0000-000000000002';
