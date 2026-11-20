-- Run only in an empty disposable PostgreSQL database.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.events (
  id uuid primary key, owner_id uuid not null, kind text, status text,
  starts_at timestamptz, service_expires_at timestamptz, retention_v2 boolean,
  updated_at timestamptz not null default '2026-01-01T00:00:00Z'
);
create table public.event_media (
  id uuid primary key, event_id uuid references public.events on delete cascade,
  gallery_state text
);
-- Load the real deadline function from the repository; its other grants need these tables.
create table public.guestbook_entries(id integer);
create table public.rsvps(id integer);
\ir ../../supabase/migrations/202611090001_event_retention_policy_alignment.sql
\ir ../../supabase/migrations/202611200001_invitation_posters.sql
\ir ../../supabase/migrations/202611200002_validate_invitation_poster_save.sql
grant select, update on public.events, public.event_media to service_role;

insert into public.events(id, owner_id, kind, status, starts_at, retention_v2) values
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','wedding','published',now()+interval '1 day',true),
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','wedding','suspended',now()+interval '1 day',true);
insert into public.event_media values
 ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','ready');

set role service_role;
do $$
declare
  e uuid := '00000000-0000-4000-8000-000000000001';
  o uuid := '00000000-0000-4000-8000-000000000002';
  other uuid := '00000000-0000-4000-8000-000000000003';
  s jsonb := '{"englishNames":{"groom":"","bride":""},"message":"","accountSide":"none","cover":{"source":"auto","mediaId":null,"crop":{"x":50,"y":50,"zoom":1},"grayscale":true},"gallery":{"photos":[],"mainMediaId":null}}';
  photo jsonb := '{"mediaId":"00000000-0000-4000-8000-000000000004","caption":"","crop":{"x":50,"y":50,"zoom":1}}';
begin
  assert public.save_invitation_poster(e,other,'playful-pop',s,0)->>'error' = 'not_found';
  assert public.save_invitation_poster(other,o,'playful-pop',s,0)->>'error' = 'unavailable';
  assert public.save_invitation_poster(e,o,'playful-pop',
    jsonb_set(s,'{gallery,photos}',jsonb_build_array(photo)),0)->>'error' = 'media_unavailable';
  assert public.save_invitation_poster(e,o,'bad',s,0)->>'error' = 'invalid_design';
  assert public.save_invitation_poster(e,o,'playful-pop',s,-1)->>'error' = 'invalid_revision';
  assert public.save_invitation_poster(e,o,'playful-pop','[]',0)->>'error' = 'invalid_settings';
  assert public.save_invitation_poster(e,o,'playful-pop',
    jsonb_set(s,'{gallery,photos}','[42]'),0)->>'error' = 'invalid_settings';
  assert public.save_invitation_poster(e,o,'playful-pop',
    jsonb_set(s,'{cover,crop}','42'),0)->>'error' = 'invalid_settings';
  assert public.save_invitation_poster(e,o,'playful-pop',
    jsonb_set(s,'{gallery,photos}',jsonb_build_array(photo,photo)),0)->>'error' = 'invalid_media_id';
  assert public.save_invitation_poster(e,o,'playful-pop',
    jsonb_set(s,'{gallery,photos}',jsonb_build_array(photo || '{"mediaId":"bad"}'::jsonb)),0)->>'error' = 'invalid_media_id';
  assert public.save_invitation_poster(e,o,'playful-pop',s,0)#>>'{poster,revision}' = '1';
  assert public.save_invitation_poster(e,o,'playful-pop',s,0)->>'error' = 'revision_conflict';
  assert public.save_invitation_poster(e,o,'modern-editorial',s,1)#>>'{poster,revision}' = '2';
  assert public.save_invitation_poster(e,o,'playful-pop',s,1)->>'error' = 'revision_conflict';
  assert (select updated_at = '2026-01-01T00:00:00Z'::timestamptz from public.events where id = e);
  assert (select count(*) = 1 from public.invitation_posters);
end $$;
reset role;

update public.events set retention_v2 = false, service_expires_at = now() - interval '1 second'
where id = '00000000-0000-4000-8000-000000000001';
do $$ begin
  assert public.save_invitation_poster('00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002','playful-pop','{"gallery":{"photos":[]}}',2)->>'error' = 'expired';
  assert not has_table_privilege('authenticated','public.invitation_posters','SELECT');
  assert not has_function_privilege('anon','public.save_invitation_poster(uuid,uuid,text,jsonb,integer)','EXECUTE');
end $$;
delete from public.events where id = '00000000-0000-4000-8000-000000000001';
do $$ begin assert not exists(select 1 from public.invitation_posters); end $$;
