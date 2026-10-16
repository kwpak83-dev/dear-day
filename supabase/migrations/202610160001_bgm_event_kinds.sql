-- Empty array means a shared BGM available for all invitation kinds.
-- Existing catalog entries remain shared.
alter table public.bgm_tracks
  add column if not exists event_kinds text[] not null default '{}'::text[];
create index if not exists bgm_tracks_event_kinds_gin_idx
  on public.bgm_tracks using gin (event_kinds);
