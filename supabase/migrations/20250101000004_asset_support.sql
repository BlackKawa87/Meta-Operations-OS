-- Support tables: status history, notes, documents, relationships, score
-- snapshots, and the asset-scoped domain event log.

create table if not exists asset_status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  previous_status text,
  new_status text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_asset_status_history_asset_id on asset_status_history(asset_id);
create index if not exists idx_asset_status_history_workspace_id on asset_status_history(workspace_id);

create table if not exists asset_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_asset_notes_asset_id on asset_notes(asset_id);
create index if not exists idx_asset_notes_workspace_id on asset_notes(workspace_id);

create trigger trg_asset_notes_updated_at
  before update on asset_notes
  for each row execute function set_updated_at();

create table if not exists asset_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  title text not null,
  storage_path text not null,          -- path within the Supabase Storage bucket
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_asset_documents_asset_id on asset_documents(asset_id);
create index if not exists idx_asset_documents_workspace_id on asset_documents(workspace_id);

create table if not exists asset_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_asset_id uuid not null references assets(id) on delete cascade,
  target_asset_id uuid not null references assets(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'owns', 'uses', 'depends_on', 'shares_with', 'managed_by', 'backup_for',
    'connected_to', 'assigned_to', 'verified_by', 'funded_by', 'controls', 'runs_on'
  )),
  strength text not null default 'normal' check (strength in ('informational', 'normal', 'critical')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (source_asset_id <> target_asset_id),
  unique (source_asset_id, target_asset_id, relationship_type)
);

create index if not exists idx_asset_rel_source on asset_relationships(source_asset_id);
create index if not exists idx_asset_rel_target on asset_relationships(target_asset_id);
create index if not exists idx_asset_rel_workspace_id on asset_relationships(workspace_id);

create table if not exists asset_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  health_score int not null check (health_score between 0 and 100),
  risk_score int not null check (risk_score between 0 and 100),
  recovery_score int not null check (recovery_score between 0 and 100),
  backup_coverage int not null check (backup_coverage between 0 and 100),
  criticality text not null check (criticality in ('low', 'medium', 'high', 'critical')),
  reasons jsonb not null default '[]',   -- factors that produced this score
  calculated_at timestamptz not null default now()
);

create index if not exists idx_asset_scores_asset_id on asset_scores(asset_id, calculated_at desc);
create index if not exists idx_asset_scores_workspace_id on asset_scores(workspace_id);

create table if not exists asset_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  event_type text not null,             -- 'created' | 'updated' | 'status_changed' | 'relationship_added' | ...
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_asset_events_asset_id on asset_events(asset_id, created_at desc);
create index if not exists idx_asset_events_workspace_id on asset_events(workspace_id);
