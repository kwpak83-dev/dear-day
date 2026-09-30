alter table public.completed_templates
  add column if not exists thumbnail_1_url text,
  add column if not exists thumbnail_2_url text;
