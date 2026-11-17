-- Private support audit trail. Only the service-role API inserts; never expose through public RLS.
create table if not exists public.admin_invitation_access_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  owner_id uuid not null,
  event_id uuid not null,
  action text not null check (action in ('preview')),
  created_at timestamptz not null default now()
);
create index if not exists admin_invitation_access_logs_event_time_idx
  on public.admin_invitation_access_logs (event_id, created_at desc);
create index if not exists admin_invitation_access_logs_admin_time_idx
  on public.admin_invitation_access_logs (admin_id, created_at desc);
alter table public.admin_invitation_access_logs enable row level security;
revoke all on public.admin_invitation_access_logs from anon, authenticated;
grant all on public.admin_invitation_access_logs to service_role;
