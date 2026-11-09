-- In-app deletion notices, retained across sign-out and de-duplicated by event and due date.
create table if not exists public.invitation_retention_notices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null,
  notice_type text not null check (notice_type in ('D-7','D-1')),
  deletion_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(event_id, notice_type, deletion_due_at)
);
create index if not exists invitation_retention_notices_owner_idx
  on public.invitation_retention_notices(owner_id, created_at desc);
alter table public.invitation_retention_notices enable row level security;
revoke all on public.invitation_retention_notices from public, anon, authenticated;
grant select, insert, update, delete on public.invitation_retention_notices to service_role;
-- Notice creation must run server-side with service credentials.
-- Owner-facing authenticated reads will be provided through a verified API.
