-- BGM-01: allow MP3 template assets without changing existing template asset policies.
do $$
declare
  asset_type_constraint text;
begin
  select c.conname
    into asset_type_constraint
  from pg_constraint c
  where c.conrelid = 'public.template_assets'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%asset_type%'
  limit 1;

  if asset_type_constraint is null then
    raise exception 'template_assets asset_type check constraint was not found';
  end if;

  execute format('alter table public.template_assets drop constraint %I', asset_type_constraint);
end
$$;

alter table public.template_assets
  add constraint template_assets_asset_type_check
  check (asset_type in (
    'thumbnail', 'long_preview', 'background', 'hero_frame',
    'decoration', 'screen_effect', 'texture', 'other', 'bgm'
  ));

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['audio/mpeg']) as mime
)
where id = 'template-assets';