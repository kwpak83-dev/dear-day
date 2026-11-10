\set ON_ERROR_STOP on
-- Run with psql on an approved read-only connection. No customer IDs,
-- invitation content, or Storage paths are returned.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '2s';
-- Refuse silently filtered counts when the approved role cannot see all rows.
set local row_security = off;

select current_setting('transaction_read_only') as read_only,
       current_setting('server_version') as postgres_version;

select to_regclass('supabase_migrations.schema_migrations') is not null as has_history,
       to_regclass('public.events') is not null
       and (select count(*) from information_schema.columns
            where table_schema = 'public' and table_name = 'events'
              and column_name in ('status','starts_at','service_expires_at','grace_ends_at')) = 4 as has_retention_columns,
       to_regclass('public.invitation_storage_cleanup_jobs') is not null
       and to_regclass('public.invitation_upload_reservations') is not null as has_storage_ledgers,
       to_regclass('public.invitation_storage_write_gate') is not null as has_storage_gate,
       exists(select 1 from information_schema.columns where table_schema='public'
         and table_name='events' and column_name='retention_v2') as has_retention_cohort
\gset

\if :has_history
select version from supabase_migrations.schema_migrations
where version in ('202609090001','202609110001','202609150001','202609190001','202609210001','202609300001','202609300002')
   or version between '202611090001' and '202611090023'
order by version;
\else
\echo Migration history unavailable. Obtain it before approval.
\endif

select name, to_regclass(name) is not null as present
from (values ('public.events'),('public.rsvps'),('public.guestbook_entries'),
  ('public.event_media'),('public.bgm_tracks'),('storage.objects'),
  ('public.completed_templates'),('public.hero_presets')) as prerequisites(name);
select table_name, column_name, udt_name
from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'events' and column_name in ('status','starts_at','service_expires_at','grace_ends_at','settings','cover_image_url'))
  or (table_name = 'completed_templates' and column_name in ('hero_preset_id','body_template_id','thumbnail_1_url','thumbnail_2_url'))
)
order by table_name, column_name;
select enumlabel from pg_enum where enumtypid = to_regtype('public.event_status') order by enumsortorder;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies where (schemaname,tablename) in (('public','events'),('storage','objects'))
order by schemaname, tablename, policyname;
select c.relname, t.tgname, t.tgenabled
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and t.tgrelid in (
  to_regclass('public.events'),to_regclass('public.event_media'),to_regclass('storage.objects'))
order by c.relname,t.tgname;

\if :has_retention_columns
-- Counterfactual impact of the original SQL 001, for rollout comparison.
with events as (
  select status::text, starts_at, service_expires_at, grace_ends_at,
         (((starts_at at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul') as new_due
  from public.events where status::text in ('published','suspended')
)
select status, count(*) as invitations,
  count(*) filter (where starts_at is null) as missing_start,
  count(*) filter (where starts_at is not null and
    (service_expires_at is distinct from new_due or grace_ends_at is distinct from new_due)) as backfill_updates,
  count(*) filter (where status='published' and (service_expires_at is null or service_expires_at>now())
    and (new_due is null or new_due<=now())) as old_policy_open_new_policy_closed,
  count(*) filter (where status='published' and service_expires_at<=now() and new_due>now()) as old_policy_closed_new_policy_open,
  count(*) filter (where new_due<=now()) as eligible_for_future_enrollment,
  count(*) filter (where starts_at is null or starts_at<=now()) as update_locked_by_001
from events group by status order by status;
\else
\echo Required retention columns missing or not visible. Stop before applying SQL 001.
\endif

\if :has_retention_cohort
select retention_v2, status::text, count(*) as invitations,
  count(*) filter (where starts_at is null) as missing_start,
  count(*) filter (where retention_v2 and starts_at is not null and
    (((starts_at at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul')<=now())
    as scheduled_policy_due
from public.events where status::text in ('published','suspended')
group by retention_v2,status order by retention_v2,status;
\endif

\if :has_storage_ledgers
select j.bucket, j.status, count(*) as jobs,
  count(*) filter (where r.id is null) as no_matching_reservation,
  count(*) filter (where r.status='reserved') as upload_not_finished,
  count(*) filter (where r.id is not null and r.event_id<>j.event_id) as queue_ownership_conflicts,
  count(*) filter (where j.storage_path ~ '^[^/]+/[^/]+$') as account_wide_paths
from public.invitation_storage_cleanup_jobs j
left join public.invitation_upload_reservations r
  on (r.bucket,r.storage_path,r.owner_id)=(j.bucket,j.storage_path,j.owner_id)
group by j.bucket,j.status order by j.bucket,j.status;
\endif
\if :has_storage_gate
select require_reservation from public.invitation_storage_write_gate where singleton;
\endif
rollback;
