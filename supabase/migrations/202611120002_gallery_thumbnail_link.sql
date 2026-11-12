-- Apply after gallery_thumbnail_path and retention 012/017/018.
-- No Storage removal or global gate changes are performed.
begin;

create or replace function public.track_gallery_thumbnail_reference()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.gallery_thumbnail_path is not null then
    insert into public.invitation_storage_object_references(event_id,bucket,storage_path)
      values(new.event_id,'invitation-photos',new.gallery_thumbnail_path)
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.track_gallery_thumbnail_reference() from public,anon,authenticated,service_role;
drop trigger if exists track_gallery_thumbnail_reference on public.event_media;
create trigger track_gallery_thumbnail_reference
after insert or update of gallery_thumbnail_path on public.event_media
for each row execute function public.track_gallery_thumbnail_reference();

-- Preserve already-linked derivatives from the first thumbnail release.
-- A fenced path aborts this transaction rather than weakening its protection.
insert into public.invitation_storage_object_references(event_id,bucket,storage_path)
select event_id,'invitation-photos',gallery_thumbnail_path from public.event_media
where gallery_thumbnail_path is not null and length(gallery_thumbnail_path) between 1 and 1024
order by event_id,gallery_thumbnail_path on conflict do nothing;

create or replace function public.link_gallery_thumbnail(p_event uuid,p_owner uuid,p_media uuid,p_path text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  invitation public.events%rowtype;
  photo public.event_media%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  -- Same event-before-media/object order as gallery mutation and upload reservation.
  select * into invitation from public.events where id=p_event for update;
  if not found or invitation.owner_id is distinct from p_owner
    or invitation.status not in ('draft','paid','published','suspended') then
    return null;
  end if;
  if invitation.status in ('published','suspended') and (
    (invitation.retention_v2 and (invitation.starts_at is null or invitation.starts_at<=clock_timestamp()))
    or (not invitation.retention_v2 and
      ((invitation.starts_at at time zone 'Asia/Seoul')::date + 1)::timestamp at time zone 'Asia/Seoul' <= clock_timestamp())
  ) then
    return null;
  end if;
  select * into photo from public.event_media where id=p_media and event_id=p_event for update;
  if not found or photo.gallery_state is distinct from 'ready' then return null; end if;
  if p_path is null or p_path !~ ('^'||p_owner::text||'/photo/'||p_event::text||'/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}[.]webp$') then
    raise exception 'Invalid thumbnail path' using errcode='22023';
  end if;
  if not exists(select 1 from public.invitation_upload_reservations
    where event_id=p_event and owner_id=p_owner and bucket='invitation-photos'
      and storage_path=p_path and status='uploaded') then
    raise exception 'Uploaded reservation required' using errcode='23514';
  end if;
  if photo.gallery_thumbnail_path is not null then
    -- A simultaneous request won. Keep the unused upload durably discoverable;
    -- the legacy cleanup queue deliberately defers physical deletion.
    if photo.gallery_thumbnail_path<>p_path then
      insert into public.gallery_storage_cleanup(storage_path,owner_id)
        values(p_path,p_owner::text) on conflict do nothing;
    end if;
    return photo.gallery_thumbnail_path;
  end if;
  update public.event_media set gallery_thumbnail_path=p_path where id=p_media;
  return p_path;
end;
$$;
revoke all on function public.link_gallery_thumbnail(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.link_gallery_thumbnail(uuid,uuid,uuid,text) to service_role;
commit;
