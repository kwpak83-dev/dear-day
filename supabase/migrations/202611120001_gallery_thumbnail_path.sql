alter table public.event_media add column if not exists gallery_thumbnail_path text;
comment on column public.event_media.gallery_thumbnail_path is 'Optional WebP gallery preview object path; full image remains in storage_path';
