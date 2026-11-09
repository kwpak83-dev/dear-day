\set ON_ERROR_STOP on
-- Stub the Storage metadata boundary in the disposable PostgreSQL database.
create schema storage;
create table storage.objects (
  bucket_id text not null, name text not null, metadata jsonb,
  last_accessed_at timestamptz, primary key(bucket_id, name)
);
alter table public.event_media add column gallery_state text;
\ir ../../supabase/migrations/202611090019_guard_invitation_storage_writes.sql

do $test$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_event uuid := '14141414-1414-4414-8414-141414141414';
  v_path text := v_owner::text || '/guard-smoke.jpg';
  v_gallery text := v_owner::text || '/gallery/guard-smoke.jpg';
  v_reservation uuid;
begin
  insert into storage.objects values('invitation-photos','legacy-path');
  insert into public.events(id,owner_id,status) values(v_event,v_owner,'draft');
  update public.invitation_storage_write_gate set require_reservation = true;
  if has_table_privilege('service_role', 'public.invitation_storage_write_gate', 'UPDATE')
    then raise exception 'Service role can bypass the write gate'; end if;
  begin
    insert into storage.objects values('invitation-photos',v_path);
    raise exception 'Unreserved upload accepted';
  exception when check_violation then null;
  end;
  v_reservation := public.reserve_invitation_upload(v_event,v_owner,'invitation-photos',v_path);
  update public.invitation_upload_reservations set created_at=clock_timestamp()-interval '2 days'
    where id=v_reservation;
  begin
    insert into storage.objects values('invitation-photos',v_path);
    raise exception 'Stale reservation allowed a new write';
  exception when check_violation then null;
  end;
  if (select status from public.invitation_upload_reservations where id=v_reservation) <> 'reserved'
    then raise exception 'Stale reservation no longer blocks cleanup'; end if;
  update public.invitation_upload_reservations set created_at=clock_timestamp() where id=v_reservation;
  insert into storage.objects values('invitation-photos',v_path);
  perform public.finish_invitation_upload(v_reservation,v_owner,true);
  update storage.objects set last_accessed_at=clock_timestamp() where name=v_path;
  begin
    update storage.objects set metadata='{"size":123}' where name=v_path;
    raise exception 'Overwrite accepted';
  exception when check_violation then null;
  end;
  begin
    insert into storage.objects values('invitation-photos',v_path);
    raise exception 'Finished reservation replay accepted';
  exception when check_violation then null;
  end;
  insert into public.event_media(event_id,storage_path,gallery_state)
    values(v_event,v_gallery,'pending');
  begin
    insert into storage.objects values('invitation-photos',v_gallery);
    raise exception 'Gallery uploaded before begin';
  exception when check_violation then null;
  end;
  update public.event_media set gallery_state='uploading' where storage_path=v_gallery;
  insert into storage.objects values('invitation-photos',v_gallery);
  insert into storage.objects values('template-assets','public-template-path');
end;
$test$;
