-- Conservative inventory only. Retain previous references until event deletion
-- so an unrecognized legacy representation cannot remove a known protection.
create function public.invitation_storage_url_path(p_value text)
returns text language plpgsql immutable set search_path = pg_catalog
as $decode$
declare
  v_bytes bytea := ''::bytea;
  v_pos integer := 1;
  v_char text;
begin
  if length(p_value) > 3072 then return null; end if;
  while v_pos <= length(p_value) loop
    v_char := substr(p_value, v_pos, 1);
    if v_char = '%' then
      if substr(p_value, v_pos + 1, 2) !~ '^[0-9a-fA-F]{2}$' then return null; end if;
      v_bytes := v_bytes || decode(substr(p_value, v_pos + 1, 2), 'hex');
      v_pos := v_pos + 3;
    else
      v_bytes := v_bytes || convert_to(v_char, 'UTF8');
      v_pos := v_pos + 1;
    end if;
  end loop;
  return convert_from(v_bytes, 'UTF8');
exception when character_not_in_repertoire or untranslatable_character then
  return null;
end;
$decode$;

create function public.invitation_storage_reference_candidates(p_settings jsonb, p_cover text)
returns table(bucket text, storage_path text)
language sql stable set search_path = pg_catalog, public
as $candidates$
  with values_to_scan(value) as (
    select v #>> '{}' from jsonb_path_query(coalesce(p_settings, '{}'::jsonb),
      'strict $.** ? (@.type() == "string")') as v
    union all select p_cover
  ), urls as (
    select regexp_match(value,
      '^https?://[^/?#]+/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/(invitation-photos|invitation-bgm)/([^?#]+)') as match
    from values_to_scan
  ), paths as (
    select match[1] as bucket, public.invitation_storage_url_path(match[2]) as storage_path
    from urls where match is not null
    union all select 'invitation-photos', p_settings #>> '{notice,imagePath}'
    union all select 'invitation-bgm', p_settings ->> 'userBgmUploadPath'
  )
  select distinct paths.bucket, paths.storage_path from paths
    where length(paths.storage_path) between 1 and 1024;
$candidates$;

create function public.record_invitation_storage_references(p_event uuid)
returns void language sql security definer set search_path = pg_catalog, public
as $record$
  insert into public.invitation_storage_object_references(event_id, bucket, storage_path)
    select p_event, candidate.bucket, candidate.storage_path
    from public.events e
    cross join lateral (
      select * from public.invitation_storage_reference_candidates(e.settings, e.cover_image_url)
      union
      select b.bucket, m.storage_path from public.event_media m
        cross join (values ('invitation-photos'), ('invitation-bgm')) b(bucket)
        where m.event_id = p_event and length(m.storage_path) between 1 and 1024
    ) candidate
    where e.id = p_event
    order by candidate.bucket, candidate.storage_path
    on conflict do nothing;
$record$;

create function public.track_invitation_storage_references()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $track$
begin
  if tg_table_name = 'events' then
    perform public.record_invitation_storage_references(new.id);
  else
    perform public.record_invitation_storage_references(new.event_id);
  end if;
  return new;
end;
$track$;

create trigger track_event_storage_references
after insert or update of settings, cover_image_url on public.events
for each row execute function public.track_invitation_storage_references();
create trigger track_media_storage_references
after insert or update of storage_path on public.event_media
for each row execute function public.track_invitation_storage_references();

create function public.backfill_invitation_storage_references(p_after uuid default null, p_limit integer default 100)
returns table(scanned integer, next_cursor uuid)
language plpgsql security definer set search_path = pg_catalog, public
as $backfill$
declare
  v_id uuid;
  v_page uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid inventory batch size' using errcode = '22023';
  end if;
  scanned := 0;
  next_cursor := null;
  -- Acquire the page's event locks before taking any shared object locks.
  select array(select id from public.events where p_after is null or id > p_after
    order by id limit p_limit for update) into v_page;
  foreach v_id in array v_page loop
    perform public.record_invitation_storage_references(v_id);
    scanned := scanned + 1;
    next_cursor := v_id;
  end loop;
  return next;
end;
$backfill$;

-- Coverage of recognized paths, not a proof that legacy or indirect references
-- are exhausted. This RPC never returns a deletion authorization.
create function public.audit_invitation_storage_inventory(p_after uuid default null, p_limit integer default 100)
returns table(scanned integer, missing bigint, next_cursor uuid, safe_to_delete boolean)
language plpgsql security definer set search_path = pg_catalog, public
as $audit$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid inventory batch size' using errcode = '22023';
  end if;
  return query
    with page as (
      select e.id, e.settings, e.cover_image_url from public.events e
      where p_after is null or e.id > p_after order by e.id limit p_limit
    ), candidates as (
      select e.id, c.bucket, c.storage_path from page e
      cross join lateral public.invitation_storage_reference_candidates(e.settings, e.cover_image_url) c
      union
      select m.event_id, b.bucket, m.storage_path from public.event_media m
      join page e on e.id = m.event_id
      cross join (values ('invitation-photos'), ('invitation-bgm')) b(bucket)
      where length(m.storage_path) between 1 and 1024
    )
    select (select count(*)::integer from page),
      (select count(*) from candidates c
       where not exists (select 1 from public.invitation_storage_object_references r
         where (r.event_id, r.bucket, r.storage_path) = (c.id, c.bucket, c.storage_path))),
      (select id from page order by id desc limit 1), false;
end;
$audit$;

revoke all on function public.invitation_storage_url_path(text),
  public.invitation_storage_reference_candidates(jsonb,text),
  public.record_invitation_storage_references(uuid),
  public.track_invitation_storage_references(),
  public.backfill_invitation_storage_references(uuid,integer),
  public.audit_invitation_storage_inventory(uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.backfill_invitation_storage_references(uuid,integer) to service_role;
grant execute on function public.audit_invitation_storage_inventory(uuid,integer) to service_role;
