-- Meta Operations OS — Tenancy schema
-- Companies > Workspaces > Teams > Users (via memberships)

create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (company_id, slug)
);

create index if not exists idx_workspaces_company_id on workspaces(company_id);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_teams_workspace_id on teams(workspace_id);

-- Mirrors auth.users with app-level profile data. One row per identity,
-- not scoped to a single workspace — a user can belong to many via memberships.
create table if not exists users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'pt', 'es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  role text not null check (role in ('owner', 'admin', 'manager', 'operator', 'viewer', 'auditor')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, workspace_id)
);

create index if not exists idx_memberships_user_id on memberships(user_id);
create index if not exists idx_memberships_workspace_id on memberships(workspace_id);

-- Helper used throughout RLS policies: does the current JWT's user
-- belong to the given workspace (optionally with role >= min_role)?
create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from memberships m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function current_user_role(target_workspace_id uuid)
returns text
language sql
security definer
stable
as $$
  select role from memberships
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
  limit 1;
$$;
