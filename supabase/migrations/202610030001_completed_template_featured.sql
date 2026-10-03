alter table public.completed_templates
  add column if not exists is_featured boolean not null default false;

create index if not exists completed_templates_featured_sort_idx
  on public.completed_templates(is_featured, sort_order, created_at);
