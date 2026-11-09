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
-- The editor saves events through the authenticated user's Supabase client.
-- Do NOT revoke event writes: doing so would break draft creation and editing.
-- Enforce event-start restrictions in a trigger for all write paths instead.
create or replace function public.enforce_event_start_edit_lock()
returns trigger language plpgsql set search_path = public as $retention_lock$
begin
  if TG_OP = 'UPDATE' and old.status in ('published', 'suspended')
     and (old.starts_at is null or old.starts_at <= now()) then
    raise exception 'EVENT_EDIT_CLOSED' using errcode = '23514';
  end if;
  if TG_OP = 'UPDATE' and new.status in ('published', 'suspended')
     and (new.starts_at is null or new.starts_at <= now()) then
    raise exception 'EVENT_DATE_MUST_BE_FUTURE' using errcode = '23514';
  end if;
  return new;
end;
$retention_lock$;
drop trigger if exists enforce_event_start_edit_lock on public.events;
create trigger enforce_event_start_edit_lock before update on public.events
  for each row execute function public.enforce_event_start_edit_lock();
revoke insert on table public.guestbook_entries from anon, authenticated;
revoke insert, update, delete on table public.rsvps from anon, authenticated;
-- Existing owner access and service_role are not revoked.
