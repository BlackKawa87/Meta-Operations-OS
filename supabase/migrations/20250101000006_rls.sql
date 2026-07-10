-- Row Level Security. Every table with a workspace_id is only visible to
-- members of that workspace; audit_logs is insert-only via trigger (no
-- direct client insert/update/delete policy is ever granted).

alter table companies enable row level security;
alter table workspaces enable row level security;
alter table teams enable row level security;
alter table users_profile enable row level security;
alter table memberships enable row level security;
alter table asset_types enable row level security;
alter table assets enable row level security;
alter table asset_status_history enable row level security;
alter table asset_notes enable row level security;
alter table asset_documents enable row level security;
alter table asset_relationships enable row level security;
alter table asset_scores enable row level security;
alter table asset_events enable row level security;
alter table audit_logs enable row level security;

-- users_profile: a user can read/update only their own profile row.
create policy users_profile_self on users_profile
  for select using (id = auth.uid());
create policy users_profile_self_update on users_profile
  for update using (id = auth.uid());
create policy users_profile_self_insert on users_profile
  for insert with check (id = auth.uid());

-- companies: visible if the user has a membership in any of its workspaces.
create policy companies_select on companies
  for select using (
    exists (
      select 1 from workspaces w
      join memberships m on m.workspace_id = w.id
      where w.company_id = companies.id and m.user_id = auth.uid()
    )
  );

-- workspaces: visible/editable only to members; admin+ can update.
create policy workspaces_select on workspaces
  for select using (is_workspace_member(id));
create policy workspaces_update on workspaces
  for update using (current_user_role(id) in ('owner', 'admin'));

-- teams
create policy teams_select on teams
  for select using (is_workspace_member(workspace_id));
create policy teams_write on teams
  for insert with check (current_user_role(workspace_id) in ('owner', 'admin'));
create policy teams_update on teams
  for update using (current_user_role(workspace_id) in ('owner', 'admin'));

-- memberships: members can see their workspace's roster; owner/admin manage it.
create policy memberships_select on memberships
  for select using (is_workspace_member(workspace_id));
create policy memberships_write on memberships
  for insert with check (current_user_role(workspace_id) in ('owner', 'admin'));
create policy memberships_update on memberships
  for update using (current_user_role(workspace_id) in ('owner', 'admin'));
create policy memberships_delete on memberships
  for delete using (current_user_role(workspace_id) in ('owner', 'admin'));

-- asset_types: global read-only catalog, not workspace-scoped.
create policy asset_types_select on asset_types
  for select using (auth.role() = 'authenticated');

-- assets: full CRUD gated by workspace membership; delete reserved for
-- owner/admin (and is soft-delete only — enforced at the API layer).
create policy assets_select on assets
  for select using (is_workspace_member(workspace_id));
create policy assets_insert on assets
  for insert with check (
    is_workspace_member(workspace_id)
    and current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator')
  );
create policy assets_update on assets
  for update using (
    is_workspace_member(workspace_id)
    and current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator')
  );
create policy assets_delete on assets
  for delete using (current_user_role(workspace_id) in ('owner', 'admin'));

-- Sub-resources: same "member can read, operator+ can write" shape.
create policy asset_status_history_select on asset_status_history
  for select using (is_workspace_member(workspace_id));
create policy asset_status_history_insert on asset_status_history
  for insert with check (
    is_workspace_member(workspace_id)
    and current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator')
  );

create policy asset_notes_select on asset_notes
  for select using (is_workspace_member(workspace_id));
create policy asset_notes_insert on asset_notes
  for insert with check (is_workspace_member(workspace_id));
create policy asset_notes_update on asset_notes
  for update using (created_by = auth.uid() or current_user_role(workspace_id) in ('owner', 'admin'));
create policy asset_notes_delete on asset_notes
  for delete using (created_by = auth.uid() or current_user_role(workspace_id) in ('owner', 'admin'));

create policy asset_documents_select on asset_documents
  for select using (is_workspace_member(workspace_id));
create policy asset_documents_insert on asset_documents
  for insert with check (is_workspace_member(workspace_id));
create policy asset_documents_delete on asset_documents
  for delete using (created_by = auth.uid() or current_user_role(workspace_id) in ('owner', 'admin'));

create policy asset_relationships_select on asset_relationships
  for select using (is_workspace_member(workspace_id));
create policy asset_relationships_insert on asset_relationships
  for insert with check (
    is_workspace_member(workspace_id)
    and current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator')
  );
create policy asset_relationships_delete on asset_relationships
  for delete using (current_user_role(workspace_id) in ('owner', 'admin', 'manager', 'operator'));

create policy asset_scores_select on asset_scores
  for select using (is_workspace_member(workspace_id));
create policy asset_scores_insert on asset_scores
  for insert with check (is_workspace_member(workspace_id));

create policy asset_events_select on asset_events
  for select using (is_workspace_member(workspace_id));
create policy asset_events_insert on asset_events
  for insert with check (is_workspace_member(workspace_id));

-- audit_logs: read-only to workspace members (auditor role included);
-- writes happen exclusively through the SECURITY DEFINER trigger function,
-- so there is deliberately no insert/update/delete policy for app roles.
create policy audit_logs_select on audit_logs
  for select using (is_workspace_member(workspace_id));
