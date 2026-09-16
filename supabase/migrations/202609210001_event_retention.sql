-- GAP ⑫: service window and retention history; no payment or deletion job.
alter table public.events
  add column if not exists service_expires_at timestamptz,
  add column if not exists grace_ends_at timestamptz;

-- ends_at is not a verified service-expiration date. Apply the current
-- documented baseline only when the event start is known.
update public.events
set service_expires_at = starts_at + interval '14 days'
where status in ('published', 'suspended')
  and service_expires_at is null
  and starts_at is not null;

update public.events
set grace_ends_at = service_expires_at + interval '30 days'
where status in ('published', 'suspended')
  and service_expires_at is not null
  and grace_ends_at is null;

create index if not exists events_retention_dates_idx
  on public.events(service_expires_at, grace_ends_at)
  where service_expires_at is not null;

-- Future paid/partner/admin extensions can record their source and duration
-- without changing the event identity or published status.
create table public.event_retention_extensions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  previous_expires_at timestamptz not null,
  new_expires_at timestamptz not null check (new_expires_at > previous_expires_at),
  source_type text not null,
  source_reference text,
  created_at timestamptz not null default now()
);
create index event_retention_extensions_event_created_idx
  on public.event_retention_extensions(event_id, created_at desc);
alter table public.event_retention_extensions enable row level security;
revoke all on table public.event_retention_extensions from public, anon, authenticated, service_role;
grant select, insert on table public.event_retention_extensions to service_role;

-- Unknown legacy expiration (NULL) remains readable until its date is resolved.
-- Direct anonymous reads and the existing child-table policies share the
-- same published-and-active check as the server-rendered invitation.
create or replace function public.is_published_event(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events
    where id = target_event_id
      and status = 'published'
      and (service_expires_at is null or service_expires_at > now())
  );
$$;

drop policy if exists "published events are public" on public.events;
create policy "published events are public" on public.events for select
  using (status = 'published' and (service_expires_at is null or service_expires_at > now()));