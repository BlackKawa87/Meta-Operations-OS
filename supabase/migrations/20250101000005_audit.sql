-- Append-only audit log. No UPDATE/DELETE policy is ever granted on this
-- table (see RLS migration) — it is the immutable record of every mutation.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity_type text not null,      -- 'asset' | 'asset_relationship' | 'asset_note' | 'asset_document' | 'membership' | ...
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete', 'status_change')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_workspace_id on audit_logs(workspace_id, created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);

create or replace function log_asset_audit()
returns trigger
language plpgsql
security definer
as $$
declare
  ws_id uuid;
  actor uuid := auth.uid();
begin
  ws_id := coalesce(new.workspace_id, old.workspace_id);

  if tg_op = 'INSERT' then
    insert into audit_logs (workspace_id, actor_id, entity_type, entity_id, action, before, after)
    values (ws_id, actor, tg_argv[0], new.id, 'insert', null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_logs (workspace_id, actor_id, entity_type, entity_id, action, before, after)
    values (ws_id, actor, tg_argv[0], new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_logs (workspace_id, actor_id, entity_type, entity_id, action, before, after)
    values (ws_id, actor, tg_argv[0], old.id, 'delete', to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_audit_assets
  after insert or update or delete on assets
  for each row execute function log_asset_audit('asset');

create trigger trg_audit_asset_relationships
  after insert or update or delete on asset_relationships
  for each row execute function log_asset_audit('asset_relationship');

create trigger trg_audit_asset_notes
  after insert or update or delete on asset_notes
  for each row execute function log_asset_audit('asset_note');

create trigger trg_audit_asset_documents
  after insert or update or delete on asset_documents
  for each row execute function log_asset_audit('asset_document');

create trigger trg_audit_memberships
  after insert or update or delete on memberships
  for each row execute function log_asset_audit('membership');
