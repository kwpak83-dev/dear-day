alter table public.completed_templates
  add column if not exists sample_content jsonb not null default '{}'::jsonb;

comment on column public.completed_templates.sample_content is
  'Admin-managed sample content used only for completed-template previews. User invitation data remains separate.';
