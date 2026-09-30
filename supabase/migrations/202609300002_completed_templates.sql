-- Completed template products: combines one Hero preset with one body theme.
create table if not exists public.completed_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_key text not null unique,
  category text not null default 'wedding',
  hero_preset_id uuid not null references public.hero_presets(id) on delete restrict,
  body_template_id uuid not null references public.templates(id) on delete restrict,
  price integer not null default 0 check (price >= 0),
  description text not null default '',
  thumbnail_url text,
  is_visible boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists completed_templates_visible_sort_idx
  on public.completed_templates(is_visible, category, sort_order, created_at);
alter table public.completed_templates enable row level security;
grant select, insert, update, delete on table public.completed_templates to service_role;
