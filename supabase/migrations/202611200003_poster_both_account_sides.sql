begin;

create or replace function public.save_invitation_poster(
  p_event uuid, p_owner uuid, p_design text, p_settings jsonb, p_revision integer
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  source public.events%rowtype;
  saved public.invitation_posters%rowtype;
  photo_id text;
  photo_ids text[] := array[]::text[];
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  photos jsonb;
  item jsonb;
begin
  select * into source from public.events where id = p_event and owner_id = p_owner for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if source.kind::text is distinct from 'wedding' or source.status::text is distinct from 'published' then
    return jsonb_build_object('error', 'unavailable');
  end if;
  if coalesce(case when source.retention_v2 is false then source.service_expires_at
    else public.event_retention_deadline_kst(source.starts_at) end, '-infinity'::timestamptz)
    <= clock_timestamp() then
    return jsonb_build_object('error', 'expired');
  end if;

  if p_design is null or p_design not in ('playful-pop','bold-pop-art','modern-editorial') then
    return jsonb_build_object('error','invalid_design');
  end if;
  if p_revision is null or p_revision < 0 or p_revision = 2147483647 then
    return jsonb_build_object('error','invalid_revision');
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object'
     or jsonb_typeof(p_settings->'gallery') is distinct from 'object'
     or jsonb_typeof(p_settings->'cover') is distinct from 'object'
     or jsonb_typeof(p_settings->'englishNames') is distinct from 'object'
     or jsonb_typeof(p_settings #> '{gallery,photos}') is distinct from 'array'
     or jsonb_typeof(p_settings->'message') is distinct from 'string'
     or jsonb_typeof(p_settings #> '{englishNames,groom}') is distinct from 'string'
     or jsonb_typeof(p_settings #> '{englishNames,bride}') is distinct from 'string'
     or length(p_settings->>'message') > 1000
     or length(p_settings #>> '{englishNames,groom}') > 80
     or length(p_settings #>> '{englishNames,bride}') > 80
     or coalesce(p_settings->>'accountSide','') not in ('none','groom','bride','both')
     or coalesce(p_settings #>> '{cover,source}','') not in ('auto','gallery')
     or jsonb_typeof(p_settings #> '{cover,grayscale}') is distinct from 'boolean' then
    return jsonb_build_object('error','invalid_settings');
  end if;

  photos := p_settings #> '{gallery,photos}';
  if jsonb_array_length(photos) > 4
     or p_settings - array['englishNames','message','accountSide','cover','gallery'] <> '{}'::jsonb
     or (p_settings->'englishNames') - array['groom','bride'] <> '{}'::jsonb
     or (p_settings->'cover') - array['source','mediaId','crop','grayscale'] <> '{}'::jsonb
     or (p_settings->'gallery') - array['mainMediaId','photos'] <> '{}'::jsonb then
    return jsonb_build_object('error','invalid_settings');
  end if;
  for item in select value from jsonb_array_elements(photos) loop
    if jsonb_typeof(item) is distinct from 'object' then
      return jsonb_build_object('error','invalid_settings');
    end if;
    if item - array['mediaId','caption','crop'] <> '{}'::jsonb
       or jsonb_typeof(item->'caption') is distinct from 'string'
       or length(item->>'caption') > 80 then
      return jsonb_build_object('error','invalid_settings');
    end if;
    photo_id := item->>'mediaId';
    if photo_id is null or photo_id !~ uuid_pattern or photo_id = any(photo_ids) then
      return jsonb_build_object('error','invalid_media_id');
    end if;
    photo_ids := array_append(photo_ids, photo_id);
  end loop;
  if (p_settings #>> '{gallery,mainMediaId}') is not null
     and not ((p_settings #>> '{gallery,mainMediaId}') = any(photo_ids)) then
    return jsonb_build_object('error','invalid_media_id');
  end if;
  photo_id := p_settings #>> '{cover,mediaId}';
  if p_settings #>> '{cover,source}' = 'gallery' then
    if photo_id is null or photo_id !~ uuid_pattern then
      return jsonb_build_object('error','invalid_media_id');
    end if;
    photo_ids := array_append(photo_ids, photo_id);
  elsif photo_id is not null then
    return jsonb_build_object('error','invalid_media_id');
  end if;
  for item in
    select p_settings #> '{cover,crop}'
    union all select value->'crop' from jsonb_array_elements(photos)
  loop
    if jsonb_typeof(item) is distinct from 'object' then
      return jsonb_build_object('error','invalid_settings');
    end if;
    if item - array['x','y','zoom'] <> '{}'::jsonb
       or jsonb_typeof(item->'x') is distinct from 'number'
       or jsonb_typeof(item->'y') is distinct from 'number'
       or jsonb_typeof(item->'zoom') is distinct from 'number' then
      return jsonb_build_object('error','invalid_settings');
    end if;
    if (item->>'x')::numeric not between 0 and 100
       or (item->>'y')::numeric not between 0 and 100
       or (item->>'zoom')::numeric not between 1 and 3 then
      return jsonb_build_object('error','invalid_settings');
    end if;
  end loop;

  foreach photo_id in array photo_ids
  loop
    perform 1 from public.event_media
      where event_id = p_event and id = photo_id::uuid and gallery_state = 'ready'
      for share;
    if not found then return jsonb_build_object('error', 'media_unavailable'); end if;
  end loop;

  if p_revision = 0 then
    insert into public.invitation_posters(event_id, design_key, settings)
    values (p_event, p_design, p_settings)
    on conflict (event_id) do nothing returning * into saved;
  else
    update public.invitation_posters
    set design_key = p_design, settings = p_settings,
        revision = revision + 1, updated_at = clock_timestamp()
    where event_id = p_event and revision = p_revision returning * into saved;
  end if;
  if not found then return jsonb_build_object('error', 'revision_conflict'); end if;
  return jsonb_build_object('poster', to_jsonb(saved));
end;
$$;

revoke all on function public.save_invitation_poster(uuid, uuid, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.save_invitation_poster(uuid, uuid, text, jsonb, integer)
  to service_role;

commit;
