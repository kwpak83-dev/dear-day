-- First-install prerequisites for the retention workers.
-- Databases that applied the original version must use SQL 023 forward.
create or replace function public.event_retention_deadline_kst(event_start timestamptz)
returns timestamptz language sql immutable set search_path = public as $$
  select case when event_start is null then null
    else (((event_start at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul')
  end;
$$;

-- Do not rewrite existing deadlines. SQL 023 introduces the policy cohort.
revoke insert on table public.guestbook_entries from anon, authenticated;
revoke insert, update, delete on table public.rsvps from anon, authenticated;
-- Existing owner access and service_role are not revoked.
