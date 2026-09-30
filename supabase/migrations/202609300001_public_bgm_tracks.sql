-- Public BGM catalog for invitation user selection.
create table if not exists public.bgm_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  composer text,
  storage_bucket text not null default 'template-assets',
  storage_path text not null,
  license_name text not null,
  source_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bgm_tracks_storage_path_key on public.bgm_tracks(storage_bucket, storage_path);
create index if not exists bgm_tracks_active_sort_idx on public.bgm_tracks(is_active, sort_order, created_at);
alter table public.bgm_tracks enable row level security;
grant select on table public.bgm_tracks to service_role;
