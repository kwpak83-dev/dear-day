-- Disposable integration fixture only. Apply immediately after 202609210002.
ALTER TABLE public.template_assets DROP CONSTRAINT template_assets_asset_type_check,
  ADD CONSTRAINT template_assets_asset_type_check CHECK (asset_type = ANY (ARRAY['thumbnail'::text, 'long_preview'::text, 'background'::text, 'hero_frame'::text, 'decoration'::text, 'screen_effect'::text, 'quick_menu_icon'::text, 'texture'::text, 'bgm'::text]));
