
begin;

alter table public.invitation_storage_cleanup_jobs
  add column if not exists expiration_path_verified boolean not null default false;
alter table public.invitation_deletion_audit
  add column if not exists photo_cleanup_holds jsonb;

create or replace function public.is_expiration_photo(p_owner uuid, p_event uuid, p_path text)
returns boolean language sql immutable set search_path = pg_catalog
as $scope$
  select p_path ~ ('^' || p_owner || '/(photo|gallery|notice)/' || p_event ||
    '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$')
$scope$;
revoke all on function public.is_expiration_photo(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Match the event lock taken by finalization so no new object can appear
-- in a verified namespace after the deletion snapshot.
create or replace function public.guard_expiration_photo_namespace()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $guard$
declare
  v_parts text[];
  v_owner uuid;
  v_event uuid;
  v_uuid constant text := '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$';
begin
  if new.bucket_id <> 'invitation-photos' then return new; end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'last_accessed_at') = (to_jsonb(old) - 'last_accessed_at') then return new; end if;
  end if;
  v_parts := string_to_array(new.name,'/');
  if v_parts[1] ~ v_uuid and v_parts[2] in ('photo','gallery','notice') and v_parts[3] ~ v_uuid then
    v_owner := v_parts[1]::uuid;
    v_event := v_parts[3]::uuid;
    perform 1 from public.events where id=v_event and owner_id=v_owner for key share;
    if not found and exists (
      select 1 from public.invitation_deletion_audit where event_id=v_event and owner_id=v_owner
        and outcome='completed' and photo_cleanup_holds is not null
    ) then
      raise exception 'Expired invitation photo directory is fenced' using errcode='23514';
    end if;
  end if;
  return new;
end;
$guard$;
revoke all on function public.guard_expiration_photo_namespace() from public,anon,authenticated,service_role;
drop trigger if exists guard_expiration_photo_namespace on storage.objects;
create trigger guard_expiration_photo_namespace before insert or update on storage.objects
for each row execute function public.guard_expiration_photo_namespace();

create or replace function public.finalize_invitation_deletion(
  p_job_id uuid, p_claim_token uuid, p_files jsonb default '[]'::jsonb
) returns boolean
language plpgsql security definer set search_path = public
as $finalize$
declare
  v_job public.invitation_deletion_jobs%rowtype;
  v_event public.events%rowtype;
  v_due timestamptz;
  v_file jsonb;
  v_bucket text;
  v_path text;
  v_media record;
  v_photo_holds jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files) > 1000 then
    raise exception 'Invalid file manifest' using errcode = '22023';
  end if;
  select * into v_job from public.invitation_deletion_jobs where id=p_job_id for update;
  if not found or v_job.status <> 'processing' or
     p_claim_token is null or v_job.claim_token is null or
     v_job.claim_token <> p_claim_token or
     v_job.claimed_at is null or v_job.lease_expires_at is null or
     v_job.lease_expires_at <= clock_timestamp() or
     v_job.attempts > 10 then
    return false;
  end if;
  select * into v_event from public.events where id=v_job.event_id for update;
  if not found or not v_event.retention_delete_eligible or v_event.owner_id <> v_job.owner_id then
    return false;
  end if;
  -- Revalidate under the event lock: a draft may have been saved or paid
  -- after the job was scheduled. A stale job must never delete that event.
  if v_event.status = 'draft' then
    if v_event.updated_at is null then return false; end if;
    v_due := v_event.updated_at + interval '720 hours';
  elsif v_event.status in ('published','suspended') and
        v_event.retention_v2 and v_event.starts_at is not null then
    v_due := public.event_retention_deadline_kst(v_event.starts_at);
  else
    return false;
  end if;
  if v_due > clock_timestamp() or v_due <> v_job.due_at or
     v_job.lease_expires_at <= clock_timestamp() then
    return false;
  end if;
  -- Read every reserved path under the event lock, including unfinished uploads.
  -- The ledger is intentionally retained after event deletion; physical cleanup
  -- must still recheck references and in-flight uploads before removing anything.
  for v_media in
    select bucket,storage_path from public.invitation_upload_reservations
    where event_id=v_event.id and owner_id=v_event.owner_id and bucket <> 'invitation-photos'
  loop
    perform public.enqueue_invitation_cleanup_object(v_event.id,v_event.owner_id,v_media.bucket,v_media.storage_path);
  end loop;

  for v_file in select value from jsonb_array_elements(p_files) loop
    v_bucket := v_file->>'bucket';
    v_path := v_file->>'storage_path';
    if v_bucket not in ('invitation-photos','invitation-bgm') or
       v_path is null or length(v_path)>1024 or
       left(v_path,length(v_job.owner_id::text)+1) <> v_job.owner_id::text || '/' then
      raise exception 'Invalid Storage path' using errcode='22023';
    end if;
    if v_bucket='invitation-bgm' then
      perform public.enqueue_invitation_cleanup_object(v_event.id,v_event.owner_id,v_bucket,v_path);
    end if;
  end loop;

  -- Snapshot trusted Storage metadata and known paths before event FK cascades.
  with inventory as materialized (
    select o.name as path, coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner') as storage_owner
    from storage.objects o
    where o.bucket_id='invitation-photos' and (
      starts_with(o.name,v_event.owner_id || '/photo/' || v_event.id || '/')
      or starts_with(o.name,v_event.owner_id || '/gallery/' || v_event.id || '/')
      or starts_with(o.name,v_event.owner_id || '/notice/' || v_event.id || '/')
    )
  ), candidates as (
    select path from inventory
    union select r.storage_path from public.invitation_upload_reservations r
      where r.event_id=v_event.id and r.owner_id=v_event.owner_id and r.bucket='invitation-photos'
    union select m.storage_path from public.event_media m where m.event_id=v_event.id
    union select m.gallery_thumbnail_path from public.event_media m where m.event_id=v_event.id
    union select r.storage_path from public.invitation_storage_object_references r
      where r.event_id=v_event.id and r.bucket='invitation-photos'
    union select c.storage_path from public.invitation_storage_reference_candidates(v_event.settings,v_event.cover_image_url) c
      where c.bucket='invitation-photos'
    union select f->>'storage_path' from jsonb_array_elements(p_files) f where f->>'bucket'='invitation-photos'
  ), evaluated as materialized (
    select c.path, i.path is not null and r.status is distinct from 'uploaded' as inventory_verified,
      case
        when not public.is_expiration_photo(v_event.owner_id,v_event.id,c.path) then 'unverified_path'
        when i.storage_owner is not null and i.storage_owner <> v_event.owner_id::text then 'storage_owner_mismatch'
        when r.bucket is not null and (r.event_id,r.owner_id)
          is distinct from (v_event.id,v_event.owner_id) then 'reservation_owner_mismatch'
        when i.path is null and r.status is distinct from 'uploaded' then 'no_ownership_evidence'
      end as hold
    from candidates c left join inventory i on i.path=c.path
    left join public.invitation_upload_reservations r on (r.bucket,r.storage_path)=('invitation-photos',c.path)
    where c.path is not null
  ), queued as (
    insert into public.invitation_storage_cleanup_jobs as j
      (event_id,owner_id,bucket,storage_path,expiration_path_verified)
    select v_event.id,v_event.owner_id,'invitation-photos',path,inventory_verified from evaluated
      where hold is null order by path
    on conflict (bucket,storage_path) do update set expiration_path_verified=excluded.expiration_path_verified
      where (j.event_id,j.owner_id)=(excluded.event_id,excluded.owner_id) and j.status in ('pending','retry')
    returning storage_path
  ), fenced as (
    insert into public.invitation_storage_objects(bucket,storage_path)
    select 'invitation-photos',storage_path from queued
    on conflict (bucket,storage_path) do nothing
  )
  select coalesce(jsonb_agg(jsonb_build_object('path',e.path,'reason',coalesce(e.hold,'queue_conflict'))
    order by e.path),'[]'::jsonb) into v_photo_holds
  from evaluated e where e.hold is not null or not exists(select 1 from queued q where q.storage_path=e.path);

  update public.invitation_storage_cleanup_jobs j set
    status='failed',last_error='Preserved: photo ownership requires review',updated_at=clock_timestamp()
  where (j.event_id,j.owner_id,j.bucket)=(v_event.id,v_event.owner_id,'invitation-photos')
    and j.status in ('pending','retry')
    and exists(select 1 from jsonb_array_elements(v_photo_holds) h where h->>'path'=j.storage_path);

  insert into public.invitation_deletion_audit(
    event_id,owner_id,outcome,details,storage_cleanup_eligible,event_kind,source_status,photo_cleanup_holds)
    values(v_event.id,v_event.owner_id,'completed',
      'Automatic 30-day DB deletion committed; photo Storage verification pending',
      true,v_event.kind::text,v_event.status::text,v_photo_holds);
  delete from public.events where id=v_event.id;
  return true;
end;
$finalize$;

create or replace function public.claim_scoped_invitation_storage_cleanup(p_job_id bigint)
returns table(bucket text, storage_path text, attempt integer)
language plpgsql security definer set search_path = pg_catalog, public
as $claim$
declare
  v_job public.invitation_storage_cleanup_jobs%rowtype;
  v_state text;
  v_enabled boolean;
  v_expiration boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select require_reservation into strict v_enabled from public.invitation_storage_write_gate
    where singleton for share;
  -- Upload gate intentionally does not block cleanup.

  select * into v_job from public.invitation_storage_cleanup_jobs j
    where j.id = p_job_id for update;
  if not found or v_job.status not in ('pending', 'retry')
    or v_job.next_attempt_at > clock_timestamp() then return; end if;
  if v_job.attempts >= 10 then
    update public.invitation_storage_cleanup_jobs set status='failed',
      last_error='Storage cleanup attempt limit reached', updated_at=clock_timestamp()
      where id=p_job_id;
    return;
  end if;
  select exists (
    select 1 from public.invitation_deletion_audit a
    where (a.event_id,a.owner_id)=(v_job.event_id,v_job.owner_id)
      and a.outcome='completed' and a.storage_cleanup_eligible and a.photo_cleanup_holds is not null
  ) into v_expiration;
  if not ((v_expiration and v_job.bucket='invitation-photos' and
    public.is_expiration_photo(v_job.owner_id,v_job.event_id,v_job.storage_path))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/gallery/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]jpg$'))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/notice/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/photo/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-bgm' and v_job.storage_path ~ ('^' || v_job.owner_id || '/bgm/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]mp3$'))) then return; end if;

  select o.state into v_state from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) for update;
  if not found or v_state not in ('active','deleting')
    or exists(select 1 from public.events where id=v_job.event_id)
    or not exists(select 1 from public.invitation_deletion_audit a
      where a.event_id=v_job.event_id and a.owner_id=v_job.owner_id and a.outcome='completed' and a.storage_cleanup_eligible)
    or (not exists(select 1 from public.invitation_upload_reservations r
      where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path)
        and r.event_id=v_job.event_id and r.owner_id=v_job.owner_id and r.status='uploaded')
      and not (v_expiration and v_job.bucket='invitation-photos' and v_job.expiration_path_verified
        and not exists(select 1 from public.invitation_upload_reservations r
          where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path)
            and (r.event_id,r.owner_id) is distinct from (v_job.event_id,v_job.owner_id))))
    or (v_expiration and v_job.bucket='invitation-photos' and exists (
      select 1 from storage.objects o where (o.bucket_id,o.name)=(v_job.bucket,v_job.storage_path)
        and coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner') <> v_job.owner_id::text
    ))
    or exists(select 1 from public.invitation_storage_object_references r
      where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path))
    or exists(select 1 from public.bgm_tracks t
      where (t.storage_bucket,t.storage_path)=(v_job.bucket,v_job.storage_path))
    or exists(select 1 from public.event_media m where m.storage_path=v_job.storage_path)
    or (v_expiration and v_job.bucket='invitation-photos' and exists (
      select 1 from public.event_media m where m.gallery_thumbnail_path=v_job.storage_path
    ))
    or exists(select 1 from public.events e where
      strpos(coalesce(e.cover_image_url,''),v_job.storage_path)>0
      or strpos(e.settings::text,v_job.storage_path)>0
      or exists(select 1 from public.invitation_storage_reference_candidates(e.settings,e.cover_image_url) c
        where (c.bucket,c.storage_path)=(v_job.bucket,v_job.storage_path)))
    then
      update public.invitation_storage_cleanup_jobs set next_attempt_at=clock_timestamp()+interval '1 day',
        last_error='Storage reference or ownership requires review', updated_at=clock_timestamp()
        where id=p_job_id;
      return;
  end if;

  update public.invitation_storage_objects o set state='deleting'
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path);
  return query
    update public.invitation_storage_cleanup_jobs j set status='retry', attempts=j.attempts+1,
      next_attempt_at=clock_timestamp()+interval '5 minutes', updated_at=clock_timestamp()
      where j.id=p_job_id returning j.bucket,j.storage_path,j.attempts;
end;
$claim$;

create or replace function public.settle_scoped_invitation_storage_cleanup(p_job_id bigint, p_attempt integer, p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $settle$
declare v_job public.invitation_storage_cleanup_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_attempt is null or p_succeeded is null then return false; end if;
  select * into v_job from public.invitation_storage_cleanup_jobs j
    where j.id=p_job_id for update;
  if not found or v_job.status <> 'retry' or v_job.attempts <> p_attempt
    or v_job.next_attempt_at <= clock_timestamp() then return false; end if;
  perform 1 from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) and o.state='deleting' for update;
  if not found then return false; end if;
  -- Reject a successful settlement for automatic photo cleanup if the
  -- Storage catalog still contains the object. API-side verification also
  -- distinguishes an actual missing object from a failed Storage lookup.
  if p_succeeded and v_job.bucket='invitation-photos' and exists (
    select 1 from public.invitation_deletion_audit a
    where (a.event_id,a.owner_id)=(v_job.event_id,v_job.owner_id)
      and a.outcome='completed' and a.storage_cleanup_eligible and a.photo_cleanup_holds is not null
  ) and exists (
    select 1 from storage.objects o where (o.bucket_id,o.name)=(v_job.bucket,v_job.storage_path)
  ) then return false; end if;
  if p_succeeded then
    update public.invitation_storage_objects o set state='deleted'
      where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path);
  end if;
  update public.invitation_storage_cleanup_jobs set
    status=case when p_succeeded then 'done' when attempts>=10 then 'failed' else 'retry' end,
    last_error=case when p_succeeded then null else 'Storage remove failed or outcome unknown' end,
    next_attempt_at=clock_timestamp()+make_interval(mins=>least(60,5*p_attempt)),
    updated_at=clock_timestamp() where id=p_job_id;
  return true;
end;
$settle$;

commit;
