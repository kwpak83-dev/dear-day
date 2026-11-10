-- Foundation for a future cleanup worker. The reference inventory is not yet
-- authoritative for legacy settings or direct Storage writes.
create table public.invitation_storage_objects (
  bucket text not null check (bucket in ('invitation-photos', 'invitation-bgm')),
  storage_path text not null check (length(storage_path) between 1 and 1024),
  state text not null default 'active'
    check (state in ('active', 'deletion_pending', 'deleting', 'deleted')),
  primary key (bucket, storage_path)
);

create table public.invitation_storage_object_references (
  event_id uuid not null references public.events(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  primary key (event_id, bucket, storage_path),
  foreign key (bucket, storage_path)
    references public.invitation_storage_objects(bucket, storage_path)
);
create index invitation_storage_object_references_object_idx
  on public.invitation_storage_object_references(bucket, storage_path);

alter table public.invitation_storage_objects enable row level security;
alter table public.invitation_storage_object_references enable row level security;
revoke all on public.invitation_storage_objects, public.invitation_storage_object_references
  from public, anon, authenticated, service_role;
grant select on public.invitation_storage_objects, public.invitation_storage_object_references
  to service_role;

-- Writers retain the object lock until their reservation/reference commits.
-- A future deletion transition must acquire this same lock before checking
-- references and reservations. No such transition is exposed by this migration.
create function public.require_active_invitation_storage_object()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $fence$
declare
  v_state text;
begin
  if tg_op = 'UPDATE' then
    if (new.bucket, new.storage_path) is distinct from (old.bucket, old.storage_path) then
      raise exception 'Storage object identity is immutable' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Match the reservation RPC's event-before-object lock order. Acquire
  -- the reference's FK lock before the object lock, not after the trigger.
  if tg_table_name = 'invitation_storage_object_references' then
    perform 1 from public.events where id = new.event_id for key share;
    if not found then
      raise exception 'Invitation no longer exists' using errcode = '23503';
    end if;
  end if;

  insert into public.invitation_storage_objects(bucket, storage_path)
    values (new.bucket, new.storage_path) on conflict (bucket, storage_path) do nothing;
  select state into strict v_state from public.invitation_storage_objects
    where bucket = new.bucket and storage_path = new.storage_path for update;
  if v_state <> 'active' then
    raise exception 'Storage object path is fenced' using errcode = '23514';
  end if;
  return new;
end;
$fence$;
revoke all on function public.require_active_invitation_storage_object()
  from public, anon, authenticated, service_role;

create trigger invitation_upload_reservations_object_fence
before insert or update of bucket, storage_path on public.invitation_upload_reservations
for each row execute function public.require_active_invitation_storage_object();

create trigger invitation_storage_references_object_fence
before insert or update on public.invitation_storage_object_references
for each row execute function public.require_active_invitation_storage_object();
