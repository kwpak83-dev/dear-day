-- Durable, service-role-only lifecycle ledger. No deletions are enabled by this migration.
create table if not exists public.invitation_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  owner_id uuid not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','retry','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invitation_deletion_jobs_pending_idx
  on public.invitation_deletion_jobs(next_attempt_at)
  where status in ('pending','retry');
alter table public.invitation_deletion_jobs enable row level security;
revoke all on public.invitation_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.invitation_deletion_jobs to service_role;

-- Durable per-object cleanup ledger survives the deletion of an event row.
create table if not exists public.invitation_storage_cleanup_jobs (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  owner_id uuid not null,
  bucket text not null check (bucket in ('invitation-photos','invitation-bgm')),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','retry','done','failed')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket,storage_path)
);
create index if not exists invitation_storage_cleanup_pending_idx
  on public.invitation_storage_cleanup_jobs(next_attempt_at)
  where status in ('pending','retry');
alter table public.invitation_storage_cleanup_jobs enable row level security;
revoke all on public.invitation_storage_cleanup_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.invitation_storage_cleanup_jobs to service_role;

-- Historical audit survives cascade and supports administrator reconciliation.
create table if not exists public.invitation_deletion_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  owner_id uuid not null,
  outcome text not null check (outcome in ('completed','failed','skipped')),
  details text,
  recorded_at timestamptz not null default now()
);
alter table public.invitation_deletion_audit enable row level security;
revoke all on public.invitation_deletion_audit from public, anon, authenticated;
grant select, insert on public.invitation_deletion_audit to service_role;
