import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import InvitationMap from "../../../components/invitation/invitation-map";
import TransportGuide from "../../../components/invitation/transport-guide";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import GrowthTimeline from "../../../components/invitation/growth-timeline";
import ParentsIntro from "../../../components/invitation/parents-intro";
import Gallery from "./gallery";
import InvitationNotice from "./invitation-notice";
import AccountCopy from "./account-copy";
import AddressCopy from "./address-copy";
import LinkCopy from "./link-copy";
import OptionalInvitationSections from "./optional-invitation-sections";
import { getInvitationTitle } from "../../../lib/invitation-title";
import { normalizeNotice } from "../../../lib/invitation-notice";
import { isPublicPeriodExpired } from "../../../lib/invitation-retention";
import { getTemplateAssetReferences, resolveTemplateAssetUrls, applySaleTemplateStyles } from "../../../lib/template-config";
import ExtendedEventInfo from "../../../components/invitation/extended-event-info";



export default async function InvitationPage({ params, searchParams }) {
  const { slug } = await params;
  const ownerView = (await searchParams)?.from === "owner";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) notFound();
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: events } = await supabase.from("events").select("id,status,kind,template_id,template_version_id,hero_preset_id,starts_at,service_expires_at,grace_ends_at,settings").eq("slug", slug).in("status", ["published", "suspended"]).limit(1);
  const event = events?.[0];
  if (!event) notFound();
  if (event.status === "suspended") return <main className="public-invitation suspended-invitation">
    {ownerView && <nav className="owner-return-nav" aria-label="DearDay 관리 화면으로 돌아가기"><a href="/my-invitations">내 초대장</a><a href="/">DearDay 홈</a></nav>}
    <section><p className="section-kicker">DEARDAY INVITATION</p><h1>현재 공개가 중지된<br />초대장입니다.</h1><p>초대장 소유자가 다시 발행하면<br />같은 주소에서 확인할 수 있습니다.</p></section>
  </main>;
  if (isPublicPeriodExpired(event)) return <main className="public-invitation suspended-invitation">
    {ownerView && <nav className="owner-return-nav" aria-label="DearDay 관리 화면으로 돌아가기"><a href="/my-invitations">내 초대장</a><a href="/">DearDay 홈</a></nav>}
    <section><p className="section-kicker">DEARDAY INVITATION</p><h1>이 초대장은 이용기간이<br />만료되었습니다.</h1><p>초대장 내용은 현재 공개되지 않습니다.</p></section>
  </main>;
  const settings = event.settings || {};
  const invitation = {
    ...settings,
    eventKind: event.kind || settings.eventKind || "wedding",
    templateId: event.template_id || settings.templateId || "",
  };
  // The selected template version depends only on the event, so fetch it alongside other metadata.
  let versionQuery = null;
  if (event.template_id) {
    versionQuery = supabase.from("template_versions")
      .select("id,template_id,status,config").eq("template_id", event.template_id);
    if (event.template_version_id) {
      versionQuery = versionQuery.eq("id", event.template_version_id);
    } else {
      versionQuery = versionQuery.order("version", { ascending: false }).limit(1);
    }
    versionQuery = versionQuery.maybeSingle();
  }
  // Promise.all consumes the query builders, starting these independent requests together.
  const [eventTypeResult, galleryResult, heroPresetResult, heroAssetsResult, bgmTrackResult, selectedVersionResult] = await Promise.all([
    supabase.from("event_type_configs")
      .select("kind,label,fields")
      .eq("kind", invitation.eventKind)
      .maybeSingle(),
    supabase.from("event_media")
      .select("id,storage_path").eq("event_id", event.id).eq("gallery_state", "ready").order("sort_order").order("id").limit(20),
    event.hero_preset_id
      ? supabase.from("hero_presets").select("id,config").eq("id", event.hero_preset_id).maybeSingle()
      : null,
    event.hero_preset_id
      ? supabase.from("hero_preset_assets").select("id,asset_type,storage_bucket,storage_path").eq("hero_preset_id", event.hero_preset_id).in("asset_type", ["hero_frame", "hero_background"]).eq("is_active", true)
      : null,
    settings.bgmMode === "user" && settings.userBgmTrackId
      ? supabase.from("bgm_tracks").select("storage_bucket,storage_path,is_active").eq("id", settings.userBgmTrackId).eq("is_active", true).maybeSingle()
      : null,
    versionQuery,
  ]);
  const { data: eventTypeConfig, error: eventTypeConfigError } = eventTypeResult;
  const { data: galleryRows, error: galleryError } = galleryResult;
  if (eventTypeConfigError) console.error("Event type config query failed:", eventTypeConfigError.code);
  // Only trust paths that match the decoration UUID and supported file types.
  // Older layers without a path continue using the Storage listing fallback.
  const decorationPathFor = (layer) => {
    const id = layer?.assetId;
    const path = layer?.assetPath;
    if (typeof id !== "string" || typeof path !== "string") return null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const prefix = `hero-decoration-library/${id}.`;
    if (!path.toLowerCase().startsWith(prefix.toLowerCase())) return null;
    const extension = path.slice(prefix.length).toLowerCase();
    return ["png", "jpg", "webp"].includes(extension) ? path : null;
  };
  // Start the HERO decoration listing early; template styles/assets can resolve in parallel.
  const hasEarlyDecorations = Boolean(
    heroPresetResult?.data?.config?.decorLayers?.some((layer) => layer.assetId && !decorationPathFor(layer)) ||
    selectedVersionResult?.data?.config?.decorations?.some((item) => item.assetId && !decorationPathFor(item))
  );
  const decorationListPromise = event.hero_preset_id && hasEarlyDecorations
    ? supabase.storage.from("template-assets").list("hero-decoration-library", { limit: 1000 })
    : null;
  let templateConfig = null;
  let templateAssets = {};
  let userBgmUrl = null;
  if (settings.bgmMode === "user" && settings.userBgmTrackId) {
    const { data: track } = bgmTrackResult;
    if (track?.storage_bucket && track?.storage_path) userBgmUrl = supabase.storage.from(track.storage_bucket).getPublicUrl(track.storage_path).data.publicUrl;
  } else if (settings.bgmMode === "upload" && settings.userBgmUploadPath) {
    userBgmUrl = supabase.storage.from("invitation-bgm").getPublicUrl(settings.userBgmUploadPath).data.publicUrl;
  }
  if (event.template_id) {
    // Pinned events must not silently switch to newer or draft versions.
    // Only legacy events without a version pin use the previous latest-version fallback.
    const { data: selectedVersion, error: versionError } = selectedVersionResult;
    if (versionError) console.error("Template version query failed:", versionError.code);
    if (event.template_version_id && !selectedVersion) console.error("Pinned template version unavailable for invitation:", slug);
    if (selectedVersion) {
      templateConfig = selectedVersion.config;
      // Admin visual edits are saved to the draft. Only its presentation fields
      // override the pinned event; keep HERO, layout and media pinned.
      const { data: draft, error: draftError } = await supabase.from("template_versions")
        .select("config").eq("template_id", event.template_id).eq("status", "draft")
        .order("version", { ascending: false }).limit(1).maybeSingle();
      if (draftError) console.error("Public draft style lookup failed:", draftError.code);
      if (draft?.config) {
        templateConfig = applySaleTemplateStyles(templateConfig, draft.config);
      } else {
        const { data: template, error: saleLookupError } = await supabase.from("templates")
          .select("current_sale_version_id,status").eq("id", event.template_id).maybeSingle();
        if (saleLookupError) console.error("Public sale template lookup failed:", saleLookupError.code);
        if (template?.status === "on_sale" && template.current_sale_version_id && template.current_sale_version_id !== selectedVersion.id) {
          const { data: saleVersion, error: saleVersionError } = await supabase.from("template_versions")
            .select("config").eq("id", template.current_sale_version_id).eq("template_id", event.template_id).maybeSingle();
          if (saleVersionError) console.error("Public sale version lookup failed:", saleVersionError.code);
          if (saleVersion?.config) templateConfig = applySaleTemplateStyles(templateConfig, saleVersion.config);
        }
      }
      const references = getTemplateAssetReferences(templateConfig);
      if (references.length) {
        const { data: assets, error: assetError } = await supabase.from("template_assets")
          .select("id,template_id,asset_type,storage_bucket,storage_path")
          .eq("template_id", event.template_id).in("id", references.map((item) => item.id));
        if (assetError) console.error("Latest template asset query failed:", assetError.code);
        templateAssets = resolveTemplateAssetUrls(templateConfig, assets, event.template_id, (asset) =>
          supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl);
      }
    }
  }
  if (event.hero_preset_id) {
    const { data: heroPreset, error: heroError } = heroPresetResult;
    if (heroError) console.error("Hero preset query failed:", heroError.code);
    if (heroPreset) {
      const { data: heroAssets, error: heroAssetError } = heroAssetsResult;
      if (heroAssetError) console.error("Hero asset query failed:", heroAssetError.code);
      const frame = heroAssets?.find((asset) => asset.asset_type === "hero_frame") || null;
      const heroBackground = heroAssets?.find((asset) => asset.asset_type === "hero_background") || null;
      const layers = [...(heroPreset.config?.decorLayers || []), ...(templateConfig?.decorations || [])];
      const decorIds = new Set(layers.map((layer) => layer.assetId).filter(Boolean));
      const directPaths = new Map(layers.flatMap((layer) => {
        const path = decorationPathFor(layer);
        return path ? [[layer.assetId, path]] : [];
      }));
      const missingIds = new Set([...decorIds].filter((id) => !directPaths.has(id)));
      let decorations = [...directPaths].map(([id, storage_path]) => ({ id, storage_bucket: "template-assets", storage_path }));
      if (missingIds.size) {
        const listed = await (decorationListPromise || supabase.storage.from("template-assets").list("hero-decoration-library", { limit: 1000 }));
        if (listed.error) console.error("Hero decoration library query failed:", listed.error.message);
        else decorations = [...decorations, ...(listed.data || []).map((file) => ({ id: file.name.split(".")[0], storage_bucket: "template-assets", storage_path: `hero-decoration-library/${file.name}` })).filter((asset) => missingIds.has(asset.id))];
      }
      templateConfig = templateConfig ? { ...templateConfig, hero: { ...templateConfig.hero, ...(heroPreset.config || {}), textLayers: [...(heroPreset.config?.textLayers || []), ...(Array.isArray(settings.heroExtraTextLayers) ? settings.heroExtraTextLayers.slice(0, 20) : [])].map((layer) => ({ ...layer, ...(settings.heroLayerOverrides?.[layer.id] || {}), text: typeof settings.heroTextOverrides?.[layer.id] === "string" ? settings.heroTextOverrides[layer.id].slice(0, 200) : layer.text })), frameAssetId: frame?.id || null, backgroundAssetId: heroBackground?.id || null } } : templateConfig;
      const mobileDecorations = layers.flatMap((layer) => { const path = layer?.mobileAssetPath; const id = layer?.assetId; return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) && path === `hero-decoration-library/${id}-mobile.webp` ? [[`${id}:mobile`, supabase.storage.from("template-assets").getPublicUrl(path).data.publicUrl]] : []; });
      templateAssets = { ...templateAssets, ...Object.fromEntries(decorations.map((asset) => [asset.id, supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl])), ...Object.fromEntries(mobileDecorations), ...(frame ? { [frame.id]: supabase.storage.from(frame.storage_bucket).getPublicUrl(frame.storage_path).data.publicUrl } : {}), ...(heroBackground ? { [heroBackground.id]: supabase.storage.from(heroBackground.storage_bucket).getPublicUrl(heroBackground.storage_path).data.publicUrl } : {}) };
    }
  }

  // Hint only the above-the-fold images. Keep the existing <img> sources and
  // Storage lookups unchanged so old decoration IDs continue to resolve.
  const heroImageUrls = new Set();
  const coverUrl = settings.coverPhotoUrl || settings.coverPhoto || null;
  // The cover is resolved by the invitation renderer; only preload when a
  // fully qualified URL is already present in the saved settings.
  if (typeof coverUrl === "string" && (coverUrl.startsWith("https://") || coverUrl.startsWith("http://"))) heroImageUrls.add(coverUrl);
  for (const layer of templateConfig?.hero?.decorLayers || []) {
    if (layer.visible === false) continue;
    const src = templateAssets[`${layer.assetId}:mobile`] || templateAssets[layer.assetId];
    if (src) heroImageUrls.add(src);
    if (heroImageUrls.size >= 5) break;
  }
  for (const item of templateConfig?.decorations || []) {
    if (item.visible === false || item.slot !== "hero") continue;
    const src = templateAssets[item.assetId];
    if (src) heroImageUrls.add(src);
    if (heroImageUrls.size >= 5) break;
  }
  for (const src of heroImageUrls) preload(src, { as: "image", fetchPriority: "high" });

  // A missing migration must not take down an existing published invitation.
  if (galleryError) console.error("Gallery query failed:", galleryError.code);
  const galleryPhotos = (galleryRows || []).map(row => ({ id: row.id, url: supabase.storage.from("invitation-photos").getPublicUrl(row.storage_path).data.publicUrl }));

  const matrixFields = eventTypeConfig?.fields || {};
  const effectiveNotice = matrixFields.notice?.state === "required" ? { ...(settings.notice || {}), enabled: true } : settings.notice;
  const publicNotice = matrixFields.notice?.state === "none" ? normalizeNotice(null) : normalizeNotice(effectiveNotice);
  const waitForNoticeBeforeHeroIntro = publicNotice.enabled && Boolean(publicNotice.title) && Boolean(publicNotice.body);

  return <main className={`public-invitation shared-public-invitation${waitForNoticeBeforeHeroIntro ? " dd-hero-intro-waits-for-notice" : ""}`}>
    {ownerView && <nav className="owner-return-nav" aria-label="DearDay 관리 화면으로 돌아가기"><a href="/my-invitations">내 초대장</a><a href="/">DearDay 홈</a></nav>}
    {matrixFields.notice?.state !== "none" && <InvitationNotice notice={effectiveNotice} slug={slug} imageUrl={settings.notice?.imagePath ? supabase.storage.from("invitation-photos").getPublicUrl(settings.notice.imagePath).data.publicUrl : null} />}
    <div className="full-invitation-renderer dd-bgm-public-style"><InvitationRenderer invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} templateId={invitation.templateId} templateConfig={templateConfig} templateAssets={templateAssets} userBgmUrl={userBgmUrl} placeActions={<><AddressCopy invitation={invitation} /><InvitationMap address={invitation.venueAddress} venue={invitation.venue} staticView deferUntilVisible /></>}>
      <div className="public-invitation-sections"><ParentsIntro invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><GrowthTimeline invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><ExtendedEventInfo invitation={invitation} eventTypeConfig={eventTypeConfig} />{matrixFields.gallery?.state !== "none" && <Gallery photos={galleryPhotos} title={matrixFields.gallery?.label || "우리의 순간들"} />}{matrixFields.transport?.state !== "none" && <TransportGuide invitation={invitation} title={matrixFields.transport?.label || "교통 안내"} required={matrixFields.transport?.state === "required"} />}<AccountCopy invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} slug={slug} startsAt={event.starts_at} /><LinkCopy path={`/invite/${slug}`} title={getInvitationTitle(invitation, invitation.eventKind)} imageUrl={invitation.kakaoShareImageUrl || invitation.coverPhotoUrl || templateAssets?.[templateConfig?.hero?.frameAssetId] || invitation.heroImageUrl || invitation.hero_image_url || galleryPhotos[0]?.url || ""} /><DearDayBrandFooter /></div>
    </InvitationRenderer></div>
</main>;
}
