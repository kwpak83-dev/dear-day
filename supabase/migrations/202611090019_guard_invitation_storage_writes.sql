-- Stage the database-side guard without changing legacy upload behavior.
-- Enable only after reservation-aware clients and Storage integration pass.
create table public.invitation_storage_write_gate (
  singleton boolean primary key default true check (singleton),
  require_reservation boolean not null default false
);
insert into public.invitation_storage_write_gate default values;
alter table public.invitation_storage_write_gate enable row level security;
revoke all on public.invitation_storage_write_gate from public, anon, authenticated, service_role;

create function public.guard_invitation_storage_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $guard$
declare
  v_enabled boolean;
  v_state text;
begin
  if new.bucket_id not in ('invitation-photos', 'invitation-bgm') then
    if tg_op <> 'UPDATE' then return new; end if;
    if old.bucket_id not in ('invitation-photos', 'invitation-bgm') then return new; end if;
  end if;

  select require_reservation into strict v_enabled from public.invitation_storage_write_gate
    where singleton for share;
  if not v_enabled then return new; end if;

  -- Customer uploads always use fresh paths and upsert:false. Permit only
  -- access-time bookkeeping on existing metadata rows.
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'last_accessed_at') = (to_jsonb(old) - 'last_accessed_at') then return new; end if;
    raise exception 'Invitation Storage objects cannot be overwritten or moved' using errcode = '23514';
  end if;

  select state into v_state from public.invitation_storage_objects
    where bucket = new.bucket_id and storage_path = new.name for update;
  if not found or v_state <> 'active' then
    raise exception 'Invitation Storage object is not reserved or is fenced' using errcode = '23514';
  end if;
  if exists (select 1 from public.invitation_upload_reservations
    where bucket = new.bucket_id and storage_path = new.name and status = 'reserved'
      and created_at >= clock_timestamp() - interval '24 hours') then
    return new;
  end if;
  -- Gallery reserves a unique path in event_media and advances it to uploading
  -- before calling Storage. SQL 018 inventories the path on that row's insert.
  if new.bucket_id = 'invitation-photos' and exists (
    select 1 from public.event_media where storage_path = new.name and gallery_state = 'uploading'
  ) then return new; end if;
  raise exception 'Invitation Storage upload requires a pending reservation' using errcode = '23514';
end;
$guard$;
revoke all on function public.guard_invitation_storage_write() from public, anon, authenticated, service_role;

create trigger guard_invitation_storage_write
before insert or update on storage.objects
for each row execute function public.guard_invitation_storage_write();
