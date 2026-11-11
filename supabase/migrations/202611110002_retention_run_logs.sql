-- Append-only execution history for retention cron endpoints.
create table if not exists public.invitation_retention_run_logs (
  id bigint generated always as identity primary key,
  task text not null check (task in ('schedule','cleanup','storage-cleanup')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  http_status integer not null,
  result_mode text,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  result_summary jsonb not null default '{}'::jsonb
);
create index if not exists invitation_retention_run_logs_recent_idx on public.invitation_retention_run_logs (finished_at desc);
alter table public.invitation_retention_run_logs enable row level security;
revoke all on public.invitation_retention_run_logs from anon, authenticated;
grant select, insert on public.invitation_retention_run_logs to service_role;
grant usage, select on sequence public.invitation_retention_run_logs_id_seq to service_role;
