-- Apply after 202609090001_initial_event_platform.sql, before deploying the gallery.
begin;
alter table public.event_media
  add column if not exists gallery_state text check (gallery_state in ('pending', 'uploading', 'ready', 'deleting')),
  add column if not exists content_hash text,
  add column if not exists gallery_updated_at timestamptz not null default now();
create unique index if not exists event_media_gallery_hash
  on public.event_media(event_id, content_hash) where gallery_state is not null;
create index if not exists event_media_gallery_order
  on public.event_media(event_id, sort_order) where gallery_state = 'ready';

-- Preserve cleanup work even if the parent invitation is deleted with ON DELETE CASCADE.
create table if not exists public.gallery_storage_cleanup (
  storage_path text primary key,
  owner_id text not null,
  created_at timestamptz not null default now()
);
alter table public.gallery_storage_cleanup enable row level security;
revoke all on public.gallery_storage_cleanup from anon, authenticated;
grant all on public.gallery_storage_cleanup to service_role;
create or replace function public.queue_deleted_gallery_file()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.gallery_state is not null then
    insert into public.gallery_storage_cleanup(storage_path,owner_id)
      values(old.storage_path,split_part(old.storage_path,'/',1)) on conflict do nothing;
  end if;
  return old;
end;
$$;
revoke all on function public.queue_deleted_gallery_file() from public, anon, authenticated;
drop trigger if exists queue_deleted_gallery_file on public.event_media;
create trigger queue_deleted_gallery_file after delete on public.event_media
  for each row execute function public.queue_deleted_gallery_file();

-- Keep existing non-gallery media behavior; gallery mutations go through the API.
drop policy if exists "owners manage event media" on public.event_media;
create policy "owners manage event media" on public.event_media for all
  using (gallery_state is null and public.is_event_owner(event_id))
  with check (gallery_state is null and public.is_event_owner(event_id));
drop policy if exists "owners read gallery" on public.event_media;
create policy "owners read gallery" on public.event_media for select
  using (public.is_event_owner(event_id));
drop policy if exists "public reads event media" on public.event_media;
create policy "public reads event media" on public.event_media for select
  using ((gallery_state is null or gallery_state = 'ready') and public.is_published_event(event_id));

-- Serialize every mutation on the parent event, including requests from other tabs.
-- The caller's user ID is validated by auth.getUser in the server API.
create or replace function public.mutate_invitation_gallery(
  p_event uuid, p_owner uuid, p_action text, p_data jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_row public.event_media;
  v_hash text;
  v_id uuid;
  v_count integer;
  v_new integer;
  v_order integer;
  v_ids uuid[];
  v_expected uuid[];
  v_actual uuid[];
  v_result jsonb := '[]';
begin
  select owner_id into v_owner from public.events where id = p_event for update;
  if v_owner is null or v_owner <> p_owner then raise exception 'GALLERY_FORBIDDEN'; end if;

  if p_action = 'reserve' then
    if jsonb_typeof(p_data->'hashes') is distinct from 'array' then raise exception 'GALLERY_INVALID'; end if;
    if jsonb_array_length(p_data->'hashes') not between 1 and 20 then raise exception 'GALLERY_LIMIT'; end if;
    if exists (select 1 from jsonb_array_elements_text(p_data->'hashes') h where h !~ '^[a-f0-9]{64}$') then raise exception 'GALLERY_INVALID'; end if;
    select count(*) into v_count from public.event_media where event_id = p_event and gallery_state in ('pending','uploading','ready');
    select count(*) into v_new from (select distinct h from jsonb_array_elements_text(p_data->'hashes') h) hashes
      where not exists (select 1 from public.event_media where event_id = p_event and content_hash = hashes.h and gallery_state is not null);
    if v_count + v_new > 20 then raise exception 'GALLERY_LIMIT'; end if;
    select coalesce(max(sort_order), -1) + 1 into v_order from public.event_media where event_id = p_event and gallery_state is not null;
    for v_hash in select h from jsonb_array_elements_text(p_data->'hashes') with ordinality t(h,n) group by h order by min(n) loop
      select * into v_row from public.event_media where event_id = p_event and content_hash = v_hash and gallery_state is not null;
      if not found then
        v_id := gen_random_uuid();
        insert into public.event_media(id,event_id,storage_path,sort_order,content_hash,gallery_state)
          values(v_id,p_event,v_owner::text || '/gallery/' || p_event::text || '/' || v_id::text || '.jpg',v_order,v_hash,'pending') returning * into v_row;
        v_order := v_order + 1;
      end if;
      v_result := v_result || jsonb_build_array(to_jsonb(v_row));
    end loop;
    return v_result;
  elsif p_action = 'reorder' then
    select coalesce(array_agg(id order by sort_order,id), '{}'::uuid[]) into v_actual from public.event_media where event_id = p_event and gallery_state = 'ready';
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_ids from jsonb_array_elements_text(p_data->'ids');
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_expected from jsonb_array_elements_text(p_data->'expected');
    if v_expected <> v_actual then raise exception 'GALLERY_CONFLICT'; end if;
    if cardinality(v_ids) <> cardinality(v_actual) or cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x)
      or not (v_ids @> v_actual and v_ids <@ v_actual) then raise exception 'GALLERY_INVALID'; end if;
    update public.event_media m set sort_order = t.n - 1, gallery_updated_at = now()
      from unnest(v_ids) with ordinality t(id,n) where m.id = t.id and m.event_id = p_event;
    return 'true'::jsonb;
  elsif p_action = 'expire' then
    -- The upload handler has a 60-second execution limit; 15 minutes is a safe grace period.
    update public.event_media set gallery_state = 'deleting', gallery_updated_at = now()
      where event_id = p_event and gallery_state in ('pending','uploading') and gallery_updated_at < now() - interval '15 minutes';
    return 'true'::jsonb;
  end if;

  select * into v_row from public.event_media where id = (p_data->>'id')::uuid and event_id = p_event and gallery_state is not null;
  if not found then return 'null'::jsonb; end if;
  if p_action = 'begin' then
    if v_row.gallery_state = 'ready' then return to_jsonb(v_row); end if;
    if v_row.gallery_state <> 'pending' then raise exception 'GALLERY_BUSY'; end if;
    update public.event_media set gallery_state = 'uploading', gallery_updated_at = now() where id = v_row.id returning * into v_row;
  elsif p_action = 'finish' then
    if v_row.gallery_state <> 'uploading' then raise exception 'GALLERY_CONFLICT'; end if;
    select coalesce(max(sort_order), -1) + 1 into v_order from public.event_media where event_id = p_event and gallery_state = 'ready';
    update public.event_media set gallery_state = 'ready', sort_order = v_order, gallery_updated_at = now() where id = v_row.id returning * into v_row;
  elsif p_action = 'delete' then
    if v_row.gallery_state in ('pending','uploading') then raise exception 'GALLERY_BUSY'; end if;
    update public.event_media set gallery_state = 'deleting', gallery_updated_at = now() where id = v_row.id returning * into v_row;
  elsif p_action = 'purge' then
    if v_row.gallery_state <> 'deleting' then raise exception 'GALLERY_CONFLICT'; end if;
    delete from public.event_media where id = v_row.id;
    -- The API has already confirmed physical deletion for this path.
    delete from public.gallery_storage_cleanup where storage_path = v_row.storage_path;
  else raise exception 'GALLERY_INVALID';
  end if;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.mutate_invitation_gallery(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mutate_invitation_gallery(uuid,uuid,text,jsonb) to service_role;
commit;
