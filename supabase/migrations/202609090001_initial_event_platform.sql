-- Dear Day: a multi-purpose invitation platform
-- Supports weddings, first-birthday parties, birthdays and other events.

create extension if not exists pgcrypto;

do $$ begin
  create type public.event_kind as enum (
    'wedding', 'first_birthday', 'birthday', 'baby_shower',
    'bridal_shower', 'anniversary', 'housewarming', 'graduation',
    'corporate', 'party', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.rsvp_status as enum ('attending', 'not_attending', 'undecided');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_kinds public.event_kind[] not null default '{}',
  thumbnail_url text,
  preview_config jsonb not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.templates(id) on delete set null,
  kind public.event_kind not null,
  status public.event_status not null default 'draft',
  slug text not null unique check (slug ~ '^[a-z0-9-]{4,80}$'),
  title text not null,
  subtitle text,
  cover_image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Asia/Seoul',
  locale text not null default 'ko-KR',
  settings jsonb not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_owner_id_idx on public.events(owner_id);
create index if not exists events_public_idx on public.events(status, starts_at) where status = 'published';

create table if not exists public.event_hosts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  role_label text,
  phone text,
  sort_order integer not null default 0
);

create table if not exists public.event_sections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  section_type text not null check (section_type in ('hero', 'message', 'gallery', 'schedule', 'map', 'rsvp', 'gift', 'guestbook', 'custom')),
  title text,
  content jsonb not null default '{}',
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.event_locations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text,
  venue_name text,
  address text,
  address_detail text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  map_url text,
  parking_note text,
  transport_note text,
  sort_order integer not null default 0
);

create table if not exists public.event_contribution_accounts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  label text,
  is_visible boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  phone text,
  status public.rsvp_status not null default 'undecided',
  party_size integer not null default 1 check (party_size between 1 and 20),
  message text,
  created_at timestamptz not null default now()
);
create index if not exists rsvps_event_id_idx on public.rsvps(event_id);

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_name text not null,
  message text not null check (char_length(message) <= 1000),
  is_approved boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists guestbook_entries_event_id_idx on public.guestbook_entries(event_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute procedure public.set_updated_at();
drop trigger if exists event_sections_set_updated_at on public.event_sections;
create trigger event_sections_set_updated_at before update on public.event_sections for each row execute procedure public.set_updated_at();

create or replace function public.is_event_owner(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = target_event_id and owner_id = auth.uid());
$$;

create or replace function public.is_published_event(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = target_event_id and status = 'published');
$$;

alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.events enable row level security;
alter table public.event_hosts enable row level security;
alter table public.event_sections enable row level security;
alter table public.event_media enable row level security;
alter table public.event_locations enable row level security;
alter table public.event_contribution_accounts enable row level security;
alter table public.rsvps enable row level security;
alter table public.guestbook_entries enable row level security;

create policy "profiles are private" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "active templates are public" on public.templates for select using (is_active);
create policy "owners manage events" on public.events for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "published events are public" on public.events for select using (status = 'published');

create policy "public reads event hosts" on public.event_hosts for select using (public.is_published_event(event_id));
create policy "owners manage event hosts" on public.event_hosts for all using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy "public reads visible sections" on public.event_sections for select using (is_visible and public.is_published_event(event_id));
create policy "owners manage event sections" on public.event_sections for all using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy "public reads event media" on public.event_media for select using (public.is_published_event(event_id));
create policy "owners manage event media" on public.event_media for all using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy "public reads event locations" on public.event_locations for select using (public.is_published_event(event_id));
create policy "owners manage event locations" on public.event_locations for all using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy "public reads visible contribution accounts" on public.event_contribution_accounts for select using (is_visible and public.is_published_event(event_id));
create policy "owners manage contribution accounts" on public.event_contribution_accounts for all using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy "owners read rsvps" on public.rsvps for select using (public.is_event_owner(event_id));
create policy "visitors submit rsvps to published events" on public.rsvps for insert with check (public.is_published_event(event_id));
create policy "public reads approved guestbook" on public.guestbook_entries for select using (is_approved and public.is_published_event(event_id));
create policy "owners manage guestbook" on public.guestbook_entries for all using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
create policy "visitors write guestbook to published events" on public.guestbook_entries for insert with check (public.is_published_event(event_id));
