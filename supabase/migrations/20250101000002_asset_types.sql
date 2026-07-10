-- Asset type catalog: single source of truth for which asset types exist
-- and which fields are relevant to each (drives the dynamic Create/Edit form).
-- This is what lets "Pixel" and "Business Manager" have different fields
-- without a dedicated SQL table per type.

create table if not exists asset_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,            -- 'pixel' | 'business_manager' | ...
  category text not null,              -- 'meta' | 'infrastructure' | 'commercial' | 'operational' | 'organizational'
  label_en text not null,
  label_pt text not null,
  label_es text not null,
  icon text not null default 'box',    -- lucide-react icon name
  fields jsonb not null default '[]',  -- [{ key, label_en, label_pt, label_es, type, required, options? }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column asset_types.fields is
  'Ordered list of type-specific field definitions rendered by the dynamic asset form. '
  'Each entry: { key, label_en, label_pt, label_es, type: text|number|url|date|select|boolean|textarea, required, options? }';
