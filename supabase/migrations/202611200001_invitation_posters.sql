begin;

create table public.invitation_posters (
  event_id uuid primary key references public.events(id) on delete cascade,
  design_key text not null check (design_key in ('playful-pop', 'bold-pop-art', 'modern-editorial')),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invitation_posters enable row level security;
revoke all on public.invitation_posters from public, anon, authenticated, service_role;
grant select, insert, update on public.invitation_posters to service_role;

create function public.save_invitation_poster(
  p_event uuid, p_owner uuid, p_design text, p_settings jsonb, p_revision integer
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  source public.events%rowtype;
  saved public.invitation_posters%rowtype;
  photo_id text;
begin
  select * into source from public.events where id = p_event and owner_id = p_owner for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if source.kind::text <> 'wedding' or source.status::text <> 'published' then
    return jsonb_build_object('error', 'unavailable');
  end if;
  if coalesce(case when source.retention_v2 is false then source.service_expires_at
    else public.event_retention_deadline_kst(source.starts_at) end, '-infinity'::timestamptz)
    <= clock_timestamp() then
    return jsonb_build_object('error', 'expired');
  end if;

  if p_revision is null or p_revision < 0
    or jsonb_typeof(p_settings #> '{gallery,photos}') is distinct from 'array' then
    return jsonb_build_object('error', 'invalid');
  end if;
  for photo_id in
    select value->>'mediaId' from jsonb_array_elements(p_settings #> '{gallery,photos}')
    union all
    select p_settings #>> '{cover,mediaId}' where p_settings #>> '{cover,source}' = 'gallery'
  loop
    perform 1 from public.event_media
      where event_id = p_event and id::text = photo_id and gallery_state = 'ready'
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
