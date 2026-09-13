-- DearDay GAP ③-A development templates.
-- Safe to run repeatedly in the Supabase SQL Editor.

insert into public.templates (id, name, event_kinds, preview_config, is_active, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', '클래식 (개발용)', array['wedding','first_birthday','birthday','baby_shower','bridal_shower','anniversary','housewarming','graduation','corporate','party','other']::public.event_kind[], '{"code":"dearday-classic-dev","stage":"development"}'::jsonb, true, 10),
  ('10000000-0000-4000-8000-000000000002', '로맨틱 (개발용)', array['wedding','first_birthday','birthday','baby_shower','bridal_shower','anniversary','housewarming','graduation','corporate','party','other']::public.event_kind[], '{"code":"dearday-romantic-dev","stage":"development"}'::jsonb, true, 20),
  ('10000000-0000-4000-8000-000000000003', '모던 (개발용)', array['wedding','first_birthday','birthday','baby_shower','bridal_shower','anniversary','housewarming','graduation','corporate','party','other']::public.event_kind[], '{"code":"dearday-modern-dev","stage":"development"}'::jsonb, true, 30)
on conflict (id) do update set
  name = excluded.name,
  event_kinds = excluded.event_kinds,
  preview_config = excluded.preview_config,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
