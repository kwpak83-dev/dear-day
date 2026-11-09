-- Durable upload reservations for event-scoped assets.
-- Reservations are recorded before Storage upload and remain discoverable after
-- a failed or interrupted upload. No physical Storage deletion is enabled.
create table if not exists public.invitation_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  owner_id uuid not null,
  bucket text not null check (bucket in ('invitation-photos','invitation-bgm')),
  storage_path text not null,
  status text not null default 'reserved' check (status in ('reserved','uploaded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket,storage_path)
);
create index if not exists invitation_upload_reservations_event_idx
  on public.invitation_upload_reservations(event_id);
alter table public.invitation_upload_reservations enable row level security;
revoke all on public.invitation_upload_reservations from public,anon,authenticated;
grant select,insert,update on public.invitation_upload_reservations to service_role;

create or replace function public.reserve_invitation_upload(
  p_event uuid,p_owner uuid,p_bucket text,p_path text
) returns uuid language plpgsql security definer set search_path=public
as $reserve$
declare v_event public.events%rowtype; v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_event is null or p_owner is null or p_bucket not in ('invitation-photos','invitation-bgm')
     or p_path is null or length(p_path)>1024
     or left(p_path,length(p_owner::text)+1)<>p_owner::text||'/' then
    raise exception 'Invalid upload reservation' using errcode='22023';
  end if;
  select * into v_event from public.events where id=p_event for update;
  if not found or v_event.owner_id<>p_owner or v_event.status not in ('draft','paid','published','suspended') then
    raise exception 'Invitation unavailable for upload' using errcode='23503';
  end if;
  if v_event.status='published' and v_event.starts_at<=clock_timestamp() then
    raise exception 'Invitation is read-only' using errcode='23514';
  end if;
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path)
    values(p_event,p_owner,p_bucket,p_path) returning id into v_id;
  return v_id;
end;
$reserve$;

create or replace function public.finish_invitation_upload(
  p_reservation uuid,p_owner uuid,p_uploaded boolean
) returns boolean language plpgsql security definer set search_path=public
as $finish$
declare v_row public.invitation_upload_reservations%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select * into v_row from public.invitation_upload_reservations where id=p_reservation for update;
  if not found or v_row.owner_id<>p_owner or v_row.status<>'reserved' then return false; end if;
  update public.invitation_upload_reservations
    set status=case when p_uploaded then 'uploaded' else 'failed' end,
        updated_at=clock_timestamp() where id=p_reservation;
  return true;
end;
$finish$;
revoke all on function public.reserve_invitation_upload(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.finish_invitation_upload(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_invitation_upload(uuid,uuid,text,text) to service_role;
grant execute on function public.finish_invitation_upload(uuid,uuid,boolean) to service_role;
