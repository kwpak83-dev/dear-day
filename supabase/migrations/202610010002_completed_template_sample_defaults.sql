create table if not exists public.completed_template_sample_defaults (
  id text primary key default 'default' check (id = 'default'),
  sample_content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.completed_template_sample_defaults enable row level security;
grant select, insert, update on table public.completed_template_sample_defaults to service_role;

insert into public.completed_template_sample_defaults (id, sample_content)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
