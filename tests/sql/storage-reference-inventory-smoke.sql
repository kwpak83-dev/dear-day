\set ON_ERROR_STOP on
alter table public.events add column settings jsonb, add column cover_image_url text;
insert into public.events(id, owner_id, status, settings, cover_image_url)
values ('12121212-1212-4212-8212-121212121212', '11111111-1111-4111-8111-111111111111', 'draft',
  '{"hero":{"photo":"https://example.test/storage/v1/render/image/public/invitation-photos/a%2Fhello%20world.jpg?width=10"},
    "notice":{"imagePath":"a/notice.jpg"},"userBgmUploadPath":"a/music.mp3"}',
  'https://example.test/storage/v1/object/public/invitation-photos/a/hello%20world.jpg#image');
\ir ../../supabase/migrations/202611090018_inventory_invitation_storage_references.sql

do $test$
declare
  v_event uuid := '12121212-1212-4212-8212-121212121212';
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '13131313-1313-4313-8313-131313131313';
begin
  if not exists(select 1 from public.audit_invitation_storage_inventory() where missing=3 and not safe_to_delete)
    then raise exception 'Audit did not detect missing legacy references'; end if;
  perform public.backfill_invitation_storage_references();
  perform public.backfill_invitation_storage_references();
  if (select count(*) from public.invitation_storage_object_references where event_id=v_event) <> 3
    then raise exception 'Backfill lost or duplicated references'; end if;
  if not exists(select 1 from public.audit_invitation_storage_inventory() where missing=0 and not safe_to_delete)
    then raise exception 'Inventory audit coverage or safety incorrect'; end if;
  insert into public.events(id, owner_id, status, cover_image_url)
    values(v_other,v_owner,'draft','https://example.test/storage/v1/object/sign/invitation-photos/a/hello%20world.jpg?token=fixture');
  insert into public.event_media(event_id,storage_path) values(v_other,'a/gallery.jpg');
  if (select count(*) from public.invitation_storage_object_references where event_id=v_other) <> 3
    then raise exception 'Shared cover or media was not recorded atomically'; end if;
  insert into public.invitation_storage_objects values('invitation-photos','a/fenced.jpg','deleting');
  begin
    update public.events set cover_image_url='https://example.test/storage/v1/object/public/invitation-photos/a/fenced.jpg'
      where id=v_other;
    raise exception 'Event update bypassed the fence';
  exception when check_violation then null;
  end;
  if (select cover_image_url from public.events where id=v_other) not like '%hello%20world.jpg%'
    then raise exception 'Fenced reference did not roll back the event update'; end if;
end;
$test$;
