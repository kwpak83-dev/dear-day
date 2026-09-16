-- Inquiries are private and accessed only through authenticated server APIs.
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('invitation', 'payment', 'account', 'issue', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index inquiries_user_created_idx on public.inquiries(user_id, created_at desc);

-- Keep administrator answers as append-only records for future corrections.
create table public.inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index inquiry_replies_inquiry_created_idx on public.inquiry_replies(inquiry_id, created_at);

alter table public.inquiries enable row level security;
alter table public.inquiry_replies enable row level security;
revoke all on table public.inquiries, public.inquiry_replies from public, anon, authenticated, service_role;
grant select, insert on table public.inquiries to service_role;
grant update (status, answered_at) on table public.inquiries to service_role;
grant select, insert on table public.inquiry_replies to service_role;