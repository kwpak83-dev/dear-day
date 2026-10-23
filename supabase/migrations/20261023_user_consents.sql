-- Apply in the Supabase SQL editor before enabling the consent flow.
create table if not exists public.user_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  terms_agreed_at timestamptz not null,
  privacy_agreed_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.user_consents enable row level security;
-- No client-facing policies: only server-side verified service-role requests can access this table.
