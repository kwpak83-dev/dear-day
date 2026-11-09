-- New migration; do not rewrite historical migrations.
-- IMPORTANT: Review production preview before applying. This changes public visibility.
create or replace function public.event_retention_deadline_kst(event_start timestamptz)
returns timestamptz language sql immutable set search_path = public as $$
  select case when event_start is null then null
    else (((event_start at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul')
  end;
$$;

-- Keep compatibility columns in sync for existing published invitations.
update public.events
set service_expires_at = public.event_retention_deadline_kst(starts_at),
    grace_ends_at = public.event_retention_deadline_kst(starts_at)
where status in ('published', 'suspended') and starts_at is not null
  and (service_expires_at is distinct from public.event_retention_deadline_kst(starts_at)
    or grace_ends_at is distinct from public.event_retention_deadline_kst(starts_at));

-- Fail closed for events without a valid start date.
create or replace function public.is_published_event(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events
    where id = target_event_id and status = 'published'
      and starts_at is not null
      and public.event_retention_deadline_kst(starts_at) > now()
  );
$$;

drop policy if exists "published events are public" on public.events;
create policy "published events are public" on public.events for select
  using (status = 'published' and starts_at is not null
    and public.event_retention_deadline_kst(starts_at) > now());

-- Browser clients must use server-side validation for writes.
revoke insert, update, delete on table public.events from anon, authenticated;
revoke insert on table public.guestbook_entries from anon, authenticated;
revoke insert, update, delete on table public.rsvps from anon, authenticated;
-- Existing owner access and service_role are not revoked.
