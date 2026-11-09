\set ON_ERROR_STOP on
-- Run after deletion-atomic-smoke.sql on the disposable CI database.
alter table public.events add column service_expires_at timestamptz, add column grace_ends_at timestamptz;
create table public.guestbook_entries (id uuid);
create table public.rsvps (id uuid);
\ir ../../supabase/migrations/202611090001_event_retention_policy_alignment.sql
\ir ../../supabase/migrations/202611090016_reconcile_retention_schedule.sql

do $test$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  event uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  second_event uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  starts timestamptz := date_trunc('day', clock_timestamp() at time zone 'Asia/Seoul')
                        at time zone 'Asia/Seoul' + interval '5 days';
  job uuid;
  token uuid;
  old_due timestamptz;
begin
  insert into public.events(id,owner_id,status,starts_at)
    values(event,owner,'published',starts),(second_event,owner,'published',starts);
  insert into public.invitation_deletion_jobs(event_id,owner_id,due_at)
    values(event,owner,clock_timestamp()-interval '1 day') returning id into job;
  select claim_token into token from public.claim_invitation_deletion_job(job,10);
  if token is null then raise exception 'fixture claim failed'; end if;
  update public.events set starts_at=starts+interval '1 day' where id=event;
  if public.reconcile_invitation_deletion_schedule(array[event]) <> 1
    then raise exception 'postponement not reconciled'; end if;
  if public.finalize_invitation_deletion(job,token,'[]') or
     public.retry_invitation_deletion_job(job,token,'old worker')
    then raise exception 'old token survived rescheduling'; end if;
  if not exists(select 1 from public.invitation_deletion_jobs where id=job
    and due_at=public.event_retention_deadline_kst(starts+interval '1 day')
    and next_attempt_at=due_at and status='pending' and attempts=0
    and claim_token is null and claimed_at is null and lease_expires_at is null)
    then raise exception 'invalid rescheduled state'; end if;
  update public.events set starts_at=starts where id=event;
  if public.reconcile_invitation_deletion_schedule(array[event,event]) <> 1
    then raise exception 'earlier date not reconciled exactly once'; end if;
  update public.events set starts_at=starts+interval '1 hour' where id=event;
  if public.reconcile_invitation_deletion_schedule(array[event]) <> 0
    then raise exception 'same KST day reset schedule'; end if;
  select due_at into old_due from public.invitation_deletion_jobs where id=job;
  update public.events set starts_at=starts+interval '2 days' where id=event;
  begin
    perform public.reconcile_invitation_deletion_schedule(array[event]);
    raise exception 'forced transaction rollback' using errcode='P0002';
  exception when sqlstate 'P0002' then null;
  end;
  if (select due_at from public.invitation_deletion_jobs where id=job) is distinct from old_due
    then raise exception 'rollback lost the original schedule'; end if;
  update public.invitation_deletion_jobs set status='processing',attempts=10,
    claim_token=gen_random_uuid(),claimed_at=clock_timestamp()-interval '20 minutes',
    lease_expires_at=clock_timestamp()-interval '10 minutes' where id=job;
  perform public.expire_invitation_deletion_leases(100);
  if public.reconcile_invitation_deletion_schedule(array[event]) <> 0 or
    (select status from public.invitation_deletion_jobs where id=job) <> 'failed'
    then raise exception 'terminal job was reactivated'; end if;
end;
$test$;
