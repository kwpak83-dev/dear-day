\set ON_ERROR_STOP on
-- Run only after upload-reservation-smoke.sql on the disposable CI database.
\ir ../../supabase/migrations/202611090002_invitation_deletion_jobs.sql
\ir ../../supabase/migrations/202611090004_retention_job_claim.sql
\ir ../../supabase/migrations/202611090006_retention_lease_recovery.sql
\ir ../../supabase/migrations/202611090010_cleanup_validation_hardening.sql
\ir ../../supabase/migrations/202611090011_retention_retry_lease_consistency.sql

do $test$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  event_id uuid := '77777777-7777-4777-8777-777777777777';
  job_id uuid;
  token uuid;
  token2 uuid;
begin
  insert into public.events(id,owner_id,status) values(event_id,owner,'draft');
  insert into public.invitation_deletion_jobs(event_id,owner_id,due_at)
    values(event_id,owner,clock_timestamp()-interval '1 day') returning id into job_id;
  select claim_token into token from public.claim_invitation_deletion_job(job_id,10);
  if token is null then raise exception 'Initial claim failed'; end if;
  if public.retry_invitation_deletion_job(job_id,gen_random_uuid(),'wrong token') then
    raise exception 'Wrong token accepted';
  end if;
  if (select status from public.invitation_deletion_jobs where id=job_id)<>'processing' then
    raise exception 'Wrong token changed status';
  end if;
  if not public.retry_invitation_deletion_job(job_id,token,'transient failure') then
    raise exception 'Valid retry rejected';
  end if;
  if exists(select 1 from public.invitation_deletion_jobs
    where id=job_id and (status<>'retry' or claim_token is not null
      or claimed_at is not null or lease_expires_at is not null)) then
    raise exception 'Retry did not clear lease';
  end if;
  if public.retry_invitation_deletion_job(job_id,token,'replay') then
    raise exception 'Stale retry token accepted';
  end if;
  update public.invitation_deletion_jobs set next_attempt_at=clock_timestamp()-interval '1 second'
    where id=job_id;
  select claim_token into token2 from public.claim_invitation_deletion_job(job_id,10);
  if token2 is null or token2=token then raise exception 'Reclaim failed to rotate token'; end if;
  if public.retry_invitation_deletion_job(job_id,token,'stale token') then
    raise exception 'Previous claim token accepted';
  end if;
  update public.invitation_deletion_jobs
    set attempts=10, lease_expires_at=clock_timestamp()-interval '1 second'
    where id=job_id;
  if public.retry_invitation_deletion_job(job_id,token2,'expired lease') then
    raise exception 'Expired lease accepted retry';
  end if;
  if public.expire_invitation_deletion_leases(100)<>1 then
    raise exception 'Expired max-attempt job not marked failed';
  end if;
  if exists(select 1 from public.invitation_deletion_jobs
    where id=job_id and (status<>'failed' or claim_token is not null
      or claimed_at is not null or lease_expires_at is not null)) then
    raise exception 'Terminal job still holds lease';
  end if;
  if exists(select 1 from public.claim_invitation_deletion_job(job_id,10)) then
    raise exception 'Terminal job was reclaimed';
  end if;
  begin
    perform public.claim_invitation_deletion_job(job_id,null);
    raise exception 'Null lease accepted';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'PASS: token isolation, retry, stale token, expired lease, max attempts';
end;
$test$;
