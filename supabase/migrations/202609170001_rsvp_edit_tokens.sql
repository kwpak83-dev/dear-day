-- Store only a one-way hash of each guest's RSVP edit token.
alter table public.rsvps
  add column if not exists edit_token_hash text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists rsvps_edit_token_hash_idx
  on public.rsvps(edit_token_hash)
  where edit_token_hash is not null;

drop trigger if exists rsvps_set_updated_at on public.rsvps;
create trigger rsvps_set_updated_at
  before update on public.rsvps
  for each row execute procedure public.set_updated_at();

-- RSVP lookup and editing stay behind the server API.
grant select, update on table public.rsvps to service_role;