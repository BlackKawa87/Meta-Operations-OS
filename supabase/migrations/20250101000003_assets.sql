-- Core assets table. Generic fields common to every asset type; type-specific
-- data lives in `attributes` (validated server-side against asset_types.fields).

create extension if not exists pg_trgm;

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_type_id uuid not null references asset_types(id),

  name text not null,
  description text,
  status text not null default 'pending' check (status in (
    'active', 'inactive', 'pending', 'under_review', 'limited', 'restricted',
    'blocked', 'disabled', 'suspended', 'needs_verification', 'at_risk',
    'backup', 'archived'
  )),
  criticality text not null default 'medium' check (criticality in ('low', 'medium', 'high', 'critical')),

  owner_id uuid references auth.users(id),
  team_id uuid references teams(id) on delete set null,

  -- Denormalized current scores (fast reads); asset_scores below keeps history.
  health_score int not null default 100 check (health_score between 0 and 100),
  risk_score int not null default 0 check (risk_score between 0 and 100),
  recovery_score int not null default 100 check (recovery_score between 0 and 100),
  backup_coverage int not null default 0 check (backup_coverage between 0 and 100),

  attributes jsonb not null default '{}',  -- type-specific field values
  tags text[] not null default '{}',

  last_used_at timestamptz,
  last_incident_at timestamptz,
  archived_at timestamptz,               -- soft delete

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_assets_workspace_id on assets(workspace_id);
create index if not exists idx_assets_asset_type_id on assets(asset_type_id);
create index if not exists idx_assets_status on assets(status);
create index if not exists idx_assets_criticality on assets(criticality);
create index if not exists idx_assets_owner_id on assets(owner_id);
create index if not exists idx_assets_archived_at on assets(archived_at);
create index if not exists idx_assets_workspace_status on assets(workspace_id, status);
create index if not exists idx_assets_name_trgm on assets using gin (name gin_trgm_ops);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_assets_updated_at
  before update on assets
  for each row execute function set_updated_at();
