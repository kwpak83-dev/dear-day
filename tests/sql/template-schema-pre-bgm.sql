-- Disposable integration fixture only. Apply after 202609090001 and before 202609210002.
-- Source: six-table catalog export. Do not run on an existing or production database.
-- Admin RLS and unexported grants are deferred. No permissive stand-in for is_admin().
-- The original asset CHECK was unavailable. Bootstrap with the exported CHECK;
-- 202609210002 replaces it, then template-schema-post-bgm.sql restores the exported definition.
SET search_path TO public;

ALTER TABLE public.templates ADD COLUMN template_key text NOT NULL;
ALTER TABLE public.templates ADD COLUMN description text;
ALTER TABLE public.templates ADD COLUMN status text DEFAULT 'draft'::text NOT NULL;
ALTER TABLE public.templates ADD COLUMN current_sale_version_id uuid;
ALTER TABLE public.templates ADD COLUMN is_visible boolean DEFAULT true NOT NULL;
ALTER TABLE public.templates ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE public.templates ADD COLUMN event_kind text DEFAULT 'wedding'::text NOT NULL;

CREATE TABLE public.template_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid NOT NULL,
  version integer NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  config_schema_version integer DEFAULT 1 NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  change_note text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT template_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT template_versions_pkey PRIMARY KEY (id),
  CONSTRAINT template_versions_status_check CHECK (status = ANY (ARRAY['draft'::text, 'review'::text, 'active'::text, 'archived'::text])),
  CONSTRAINT template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE RESTRICT,
  CONSTRAINT template_versions_template_version_unique UNIQUE (template_id, version),
  CONSTRAINT template_versions_version_positive CHECK (version > 0)
);
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.template_assets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid NOT NULL,
  asset_type text NOT NULL,
  name text NOT NULL,
  storage_bucket text DEFAULT 'template-assets'::text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  width integer,
  height integer,
  file_size bigint,
  has_alpha boolean,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT template_assets_asset_type_check CHECK (asset_type = ANY (ARRAY['thumbnail'::text, 'long_preview'::text, 'background'::text, 'hero_frame'::text, 'decoration'::text, 'screen_effect'::text, 'quick_menu_icon'::text, 'texture'::text, 'bgm'::text])),
  CONSTRAINT template_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT template_assets_file_size_nonnegative CHECK (file_size IS NULL OR file_size >= 0),
  CONSTRAINT template_assets_height_positive CHECK (height IS NULL OR height > 0),
  CONSTRAINT template_assets_pkey PRIMARY KEY (id),
  CONSTRAINT template_assets_storage_unique UNIQUE (storage_bucket, storage_path),
  CONSTRAINT template_assets_template_id_fkey FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE RESTRICT,
  CONSTRAINT template_assets_width_positive CHECK (width IS NULL OR width > 0)
);
ALTER TABLE public.template_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hero_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  preset_key text NOT NULL,
  description text,
  status text DEFAULT 'draft'::text NOT NULL,
  is_visible boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  event_kind text DEFAULT 'wedding'::text NOT NULL,
  CONSTRAINT hero_presets_pkey PRIMARY KEY (id),
  CONSTRAINT hero_presets_preset_key_key UNIQUE (preset_key),
  CONSTRAINT hero_presets_status_check CHECK (status = ANY (ARRAY['draft'::text, 'on_sale'::text, 'stopped'::text]))
);
ALTER TABLE public.hero_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ADD CONSTRAINT templates_current_sale_version_id_fkey FOREIGN KEY (current_sale_version_id) REFERENCES template_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.templates ADD CONSTRAINT templates_status_check CHECK (status = ANY (ARRAY['draft'::text, 'review'::text, 'sale_ready'::text, 'on_sale'::text, 'stopped'::text, 'archived'::text]));
ALTER TABLE public.events ADD COLUMN template_version_id uuid;
ALTER TABLE public.events ADD COLUMN hero_preset_id uuid;
ALTER TABLE public.events ADD CONSTRAINT events_hero_preset_id_fkey FOREIGN KEY (hero_preset_id) REFERENCES hero_presets(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD CONSTRAINT events_template_version_id_fkey FOREIGN KEY (template_version_id) REFERENCES template_versions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX templates_template_key_uidx ON public.templates USING btree (template_key);
CREATE TRIGGER templates_set_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE POLICY "templates public" ON public.templates FOR SELECT TO public USING (is_active);
CREATE INDEX template_versions_template_id_idx ON public.template_versions USING btree (template_id);
CREATE INDEX template_versions_status_idx ON public.template_versions USING btree (status);
CREATE TRIGGER template_versions_set_updated_at BEFORE UPDATE ON template_versions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE POLICY "current sale template versions are public" ON public.template_versions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM templates t
  WHERE ((t.current_sale_version_id = template_versions.id) AND (t.is_active = true) AND (t.is_visible = true)))));
CREATE INDEX template_assets_template_id_idx ON public.template_assets USING btree (template_id);
CREATE INDEX template_assets_type_idx ON public.template_assets USING btree (asset_type);
CREATE INDEX template_assets_active_idx ON public.template_assets USING btree (template_id, is_active);
CREATE TRIGGER template_assets_set_updated_at BEFORE UPDATE ON template_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE POLICY "active sale template assets are public" ON public.template_assets FOR SELECT TO public USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM templates t
  WHERE ((t.id = template_assets.template_id) AND (t.current_sale_version_id IS NOT NULL) AND (t.is_active = true) AND (t.is_visible = true))))));
CREATE INDEX hero_presets_sort_order_idx ON public.hero_presets USING btree (sort_order);
CREATE INDEX hero_presets_status_visible_idx ON public.hero_presets USING btree (status, is_visible);
CREATE INDEX events_template_version_id_idx ON public.events USING btree (template_version_id);
CREATE INDEX events_hero_preset_id_idx ON public.events USING btree (hero_preset_id);
