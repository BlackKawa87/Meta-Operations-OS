-- Contingency Core: Operational Architecture, per-type asset Roles,
-- recursive Relationship/Impact Engine, and the Checklist Engine.
-- Architecture approved in ARCHITECTURE.md §21 before this migration.

create table if not exists operational_architectures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  country text,
  product text,
  environment text not null default 'production' check (environment in ('production', 'testing', 'recovery')),
  objective text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  continuity_score int not null default 0 check (continuity_score between 0 and 100),
  health_score int not null default 100 check (health_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_audit_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_architectures_workspace_id on operational_architectures(workspace_id);

drop trigger if exists trg_architectures_updated_at on operational_architectures;
create trigger trg_architectures_updated_at
  before update on operational_architectures
  for each row execute function set_updated_at();

-- Every asset optionally belongs to one Operational Architecture, and
-- optionally carries an operational Role (validated against
-- asset_types.roles at the application layer — same data-driven pattern
-- already used for asset_types.fields, see ARCHITECTURE.md §21.3).
alter table assets add column if not exists architecture_id uuid references operational_architectures(id) on delete set null;
alter table assets add column if not exists role text;
create index if not exists idx_assets_architecture_id on assets(architecture_id);

alter table asset_types add column if not exists roles jsonb not null default '[]';
comment on column asset_types.roles is
  'Ordered list of valid operational roles for this type, e.g. [{"key":"vault","label_en":"Asset Vault","label_pt":"Fortaleza","label_es":"Bóveda"}]. Empty for types with no operational-role concept (campaigns, creatives, etc).';

update asset_types set roles = '[
  {"key":"vault","label_en":"Asset Vault (BM Fortaleza)","label_pt":"Fortaleza","label_es":"Bóveda"},
  {"key":"production","label_en":"Production","label_pt":"Produção","label_es":"Producción"},
  {"key":"backup","label_en":"Backup","label_pt":"Backup","label_es":"Respaldo"},
  {"key":"recovery","label_en":"Recovery","label_pt":"Recuperação","label_es":"Recuperación"},
  {"key":"testing","label_en":"Testing","label_pt":"Testes","label_es":"Pruebas"}
]'::jsonb where key = 'business_manager';

update asset_types set roles = '[
  {"key":"master","label_en":"Master","label_pt":"Master","label_es":"Maestro"},
  {"key":"operational","label_en":"Operational","label_pt":"Operacional","label_es":"Operacional"},
  {"key":"backup","label_en":"Backup","label_pt":"Backup","label_es":"Respaldo"},
  {"key":"testing","label_en":"Testing","label_pt":"Testes","label_es":"Pruebas"}
]'::jsonb where key = 'pixel';

update asset_types set roles = '[
  {"key":"primary","label_en":"Primary","label_pt":"Principal","label_es":"Principal"},
  {"key":"secondary","label_en":"Secondary","label_pt":"Secundária","label_es":"Secundaria"},
  {"key":"backup","label_en":"Backup","label_pt":"Backup","label_es":"Respaldo"},
  {"key":"standby","label_en":"Standby","label_pt":"Reserva","label_es":"En espera"}
]'::jsonb where key = 'ad_account';

update asset_types set roles = '[
  {"key":"owner","label_en":"Owner","label_pt":"Proprietário","label_es":"Propietario"},
  {"key":"administrator","label_en":"Administrator","label_pt":"Administrador","label_es":"Administrador"},
  {"key":"advertiser","label_en":"Advertiser","label_pt":"Anunciante","label_es":"Anunciante"},
  {"key":"backup","label_en":"Backup","label_pt":"Backup","label_es":"Respaldo"}
]'::jsonb where key = 'profile';

update asset_types set roles = '[
  {"key":"vault","label_en":"Vault","label_pt":"Fortaleza","label_es":"Bóveda"},
  {"key":"production","label_en":"Production","label_pt":"Produção","label_es":"Producción"},
  {"key":"recovery","label_en":"Recovery","label_pt":"Recuperação","label_es":"Recuperación"},
  {"key":"testing","label_en":"Testing","label_pt":"Testes","label_es":"Pruebas"}
]'::jsonb where key = 'virtual_machine';

update asset_types set roles = '[
  {"key":"primary","label_en":"Primary","label_pt":"Principal","label_es":"Principal"},
  {"key":"backup","label_en":"Backup","label_pt":"Backup","label_es":"Respaldo"},
  {"key":"testing","label_en":"Testing","label_pt":"Testes","label_es":"Pruebas"}
]'::jsonb where key = 'domain';

update asset_types set roles = '[
  {"key":"primary","label_en":"Primary","label_pt":"Principal","label_es":"Principal"},
  {"key":"backup","label_en":"Backup","label_pt":"Backup","label_es":"Respaldo"}
]'::jsonb where key = 'facebook_page';

-- Relationship Engine: unlimited-depth, bidirectional recursive traversal
-- over asset_relationships. This is the real graph engine promised in
-- ARCHITECTURE.md §21.7 — replaces the "direct relationships only" limit
-- that the Asset Manager module shipped with.
-- Postgres allows a recursive CTE exactly one non-recursive term followed
-- by exactly one recursive term — a three-way UNION ALL (base, outbound,
-- inbound) is rejected with "recursive reference ... must not appear
-- within its non-recursive term". Both directions are combined into a
-- single recursive term via a lateral join instead.
create or replace function get_asset_impact(p_asset_id uuid, p_max_depth int default 10)
returns table(affected_asset_id uuid, depth int, via_relationship_type text, direction text)
language sql
stable
as $$
  with recursive impact(asset_id, depth, via_relationship_type, direction, visited) as (
    select p_asset_id, 0, null::text, null::text, array[p_asset_id]
    union all
    select x.asset_id, i.depth + 1, x.via_relationship_type, x.direction, i.visited || x.asset_id
    from impact i
    join lateral (
      select r.target_asset_id as asset_id, r.relationship_type as via_relationship_type, 'outbound'::text as direction
      from asset_relationships r
      where r.source_asset_id = i.asset_id
      union all
      select r.source_asset_id as asset_id, r.relationship_type as via_relationship_type, 'inbound'::text as direction
      from asset_relationships r
      where r.target_asset_id = i.asset_id
    ) x on true
    where i.depth < p_max_depth and not (x.asset_id = any(i.visited))
  )
  select distinct on (asset_id) asset_id, depth, via_relationship_type, direction
  from impact
  where asset_id <> p_asset_id
  order by asset_id, depth asc;
$$;

-- Checklist Engine: generic, always tied to an Operational Architecture
-- (or standalone with architecture_id null for ad hoc checklists).
create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  architecture_id uuid references operational_architectures(id) on delete cascade,
  title text not null,
  items jsonb not null default '[]',   -- [{ key, label, done, done_at }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_checklists_workspace_id on checklists(workspace_id);
create index if not exists idx_checklists_architecture_id on checklists(architecture_id);

drop trigger if exists trg_checklists_updated_at on checklists;
create trigger trg_checklists_updated_at
  before update on checklists
  for each row execute function set_updated_at();

-- RLS: dormant in Single Operator Mode (service role bypasses it), written
-- as if auth were live, per CLAUDE.md's migration conventions.
alter table operational_architectures enable row level security;
alter table checklists enable row level security;

drop policy if exists architectures_select on operational_architectures;
drop policy if exists architectures_insert on operational_architectures;
drop policy if exists architectures_update on operational_architectures;
drop policy if exists checklists_select on checklists;
drop policy if exists checklists_insert on checklists;
drop policy if exists checklists_update on checklists;

create policy architectures_select on operational_architectures
  for select using (is_workspace_member(workspace_id));
create policy architectures_insert on operational_architectures
  for insert with check (is_workspace_member(workspace_id) and current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator'));
create policy architectures_update on operational_architectures
  for update using (is_workspace_member(workspace_id) and current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator'));

create policy checklists_select on checklists
  for select using (is_workspace_member(workspace_id));
create policy checklists_insert on checklists
  for insert with check (is_workspace_member(workspace_id));
create policy checklists_update on checklists
  for update using (is_workspace_member(workspace_id));
