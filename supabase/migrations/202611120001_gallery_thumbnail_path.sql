begin;
alter table public.event_media add column if not exists gallery_thumbnail_path text;
comment on column public.event_media.gallery_thumbnail_path is 'Optional WebP gallery preview object path; full image remains in storage_path';

-- Preserve thumbnail cleanup references on row deletion, just like original gallery files.
-- Physical deletion is deliberately deferred until global reference checks are safe.
create or replace function public.queue_deleted_gallery_file()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.gallery_state is not null then
    insert into public.gallery_storage_cleanup(storage_path,owner_id)
      values(old.storage_path,split_part(old.storage_path,'/',1)) on conflict do nothing;
    if old.gallery_thumbnail_path is not null then
      insert into public.gallery_storage_cleanup(storage_path,owner_id)
        values(old.gallery_thumbnail_path,split_part(old.storage_path,'/',1)) on conflict do nothing;
    end if;
  end if;
  return old;
end;
$$;
revoke all on function public.queue_deleted_gallery_file() from public, anon, authenticated;
commit;
