-- Preserve invitation identity at the moment its event row is deleted.
-- Works for manual deletion and retention deletion without modifying their workers.
alter table public.invitation_deletion_audit
  add column if not exists event_title text,
  add column if not exists event_starts_at timestamptz;

create or replace function public.snapshot_deleted_invitation_details()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_title text;
begin
  v_title := nullif(btrim(coalesce(to_jsonb(old)->>'title','')), '');
  update public.invitation_deletion_audit a
     set event_title = coalesce(a.event_title, v_title),
         event_starts_at = coalesce(a.event_starts_at, old.starts_at)
   where a.event_id = old.id
     and a.owner_id = old.owner_id
     and a.outcome = 'completed';
  return old;
end;
$$;

drop trigger if exists snapshot_deleted_invitation_details_trigger on public.events;
create trigger snapshot_deleted_invitation_details_trigger
before delete on public.events
for each row execute function public.snapshot_deleted_invitation_details();

revoke all on function public.snapshot_deleted_invitation_details() from public, anon, authenticated;
