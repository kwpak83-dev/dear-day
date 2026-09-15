alter table public.guestbook_entries
  add column if not exists password_hash text;

grant select, insert, delete on table public.guestbook_entries to service_role;