-- Add the reviewed common invitation areas to existing event type rows.
-- Existing contact/account nested configuration and all other fields are preserved.
update public.event_type_configs
set fields = fields || jsonb_build_object(
  'event_title', case kind
    when 'wedding' then '{"state":"none","label":"행사명/제목"}'::jsonb
    when 'first_birthday' then '{"state":"none","label":"행사명/제목"}'::jsonb
    when 'birthday' then '{"state":"optional","label":"생일파티 제목"}'::jsonb
    when 'milestone_birthday' then '{"state":"optional","label":"잔치 제목"}'::jsonb
    when 'gathering' then '{"state":"required","label":"행사명"}'::jsonb
    when 'opening' then '{"state":"required","label":"상호·행사명"}'::jsonb
    else '{"state":"optional","label":"행사명/제목"}'::jsonb
  end,
  'details', case kind
    when 'gathering' then '{"state":"optional","label":"행사 세부안내"}'::jsonb
    when 'opening' then '{"state":"optional","label":"오픈·이벤트 안내"}'::jsonb
    else '{"state":"none","label":"행사 세부안내"}'::jsonb
  end,
  'external_link', case kind
    when 'gathering' then '{"state":"optional","label":"외부링크"}'::jsonb
    when 'opening' then '{"state":"optional","label":"홈페이지·외부링크"}'::jsonb
    else '{"state":"none","label":"외부링크"}'::jsonb
  end,
  'brand_image', case kind
    when 'gathering' then '{"state":"optional","label":"로고·대표이미지"}'::jsonb
    when 'opening' then '{"state":"optional","label":"로고·대표이미지"}'::jsonb
    else '{"state":"none","label":"로고·대표이미지"}'::jsonb
  end
),
updated_at = now()
where kind in ('wedding','first_birthday','birthday','milestone_birthday','gathering','opening');
