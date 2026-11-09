\set ON_ERROR_STOP on
-- Isolated PostgreSQL fixture: never point this at production.
create role service_role nologin;
create role authenticated nologin;
create role anon nologin;
create schema auth;
create function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
create table public.events (
  id uuid primary key,
  owner_id uuid not null,
  status text not null,
  starts_at timestamptz,
  updated_at timestamptz not null default now()
);
\ir ../../supabase/migrations/202611090012_upload_reservations.sql
\ir ../../supabase/migrations/202611090014_upload_reservation_readonly_guard.sql
do $test$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  draft uuid := '22222222-2222-4222-8222-222222222222';
  expired uuid := '33333333-3333-4333-8333-333333333333';
  rid uuid;
begin
  insert into public.events(id,owner_id,status) values(draft,owner,'draft');
  insert into public.events(id,owner_id,status,starts_at)
    values(expired,owner,'suspended',clock_timestamp()-interval '1 day');
  rid := public.reserve_invitation_upload(draft,owner,'invitation-photos',owner::text||'/photo.jpg');
  if rid is null then raise exception 'reservation not created'; end if;
  if not public.finish_invitation_upload(rid,owner,true) then raise exception 'finish failed'; end if;
  if (select status from public.invitation_upload_reservations where id=rid)<>'uploaded'
    then raise exception 'reservation status incorrect'; end if;
  if public.finish_invitation_upload(rid,owner,true) then
    raise exception 'double finish unexpectedly succeeded';
  end if;
  begin
    perform public.reserve_invitation_upload(expired,owner,'invitation-bgm',owner::text||'/music.mp3');
    raise exception 'expired suspended event accepted upload';
  exception when sqlstate '23514' then null;
  end;
  begin
    perform public.reserve_invitation_upload(draft,owner,'invitation-photos','other-owner/photo.jpg');
    raise exception 'foreign owner path accepted';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'PASS: reservation, finish, replay rejection, read-only fence, path validation';
end;
$test$;
