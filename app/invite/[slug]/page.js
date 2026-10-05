import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
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
import { getTemplateAssetReferences, resolveTemplateAssetUrls } from "../../../lib/template-config";

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
  const { data: eventTypeConfig, error: eventTypeConfigError } = await supabase.from("event_type_configs")
    .select("kind,label,fields")
    .eq("kind", invitation.eventKind)
    .maybeSingle();
  if (eventTypeConfigError) console.error("Event type config query failed:", eventTypeConfigError.code);
  let templateConfig = null;
  let templateAssets = {};
  let userBgmUrl = null;
  if (settings.bgmMode === "user" && settings.userBgmTrackId) {
    const { data: track } = await supabase.from("bgm_tracks").select("storage_bucket,storage_path,is_active").eq("id", settings.userBgmTrackId).eq("is_active", true).maybeSingle();
    if (track?.storage_bucket && track?.storage_path) userBgmUrl = supabase.storage.from(track.storage_bucket).getPublicUrl(track.storage_path).data.publicUrl;
  } else if (settings.bgmMode === "upload" && settings.userBgmUploadPath) {
    userBgmUrl = supabase.storage.from("invitation-bgm").getPublicUrl(settings.userBgmUploadPath).data.publicUrl;
  }
  if (event.template_id) {
    const { data: latestVersion, error: versionError } = await supabase.from("template_versions")
      .select("id,template_id,status,config").eq("template_id", event.template_id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (versionError) console.error("Latest template version query failed:", versionError.code);
    if (latestVersion) {
      templateConfig = latestVersion.config;
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
    const { data: heroPreset, error: heroError } = await supabase.from("hero_presets").select("id,config").eq("id", event.hero_preset_id).maybeSingle();
    if (heroError) console.error("Hero preset query failed:", heroError.code);
    if (heroPreset) {
      const { data: heroAssets, error: heroAssetError } = await supabase.from("hero_preset_assets").select("id,asset_type,storage_bucket,storage_path").eq("hero_preset_id", heroPreset.id).eq("asset_type", "hero_frame").eq("is_active", true).limit(1);
      if (heroAssetError) console.error("Hero asset query failed:", heroAssetError.code);
      const frame = heroAssets?.[0] || null;
      const decorIds = new Set([...(heroPreset.config?.decorLayers || []).map((layer) => layer.assetId),...(templateConfig?.decorations || []).map((item) => item.assetId)].filter(Boolean));
      let decorations = [];
      if (decorIds.size) {
        const listed = await supabase.storage.from("template-assets").list("hero-decoration-library", { limit: 1000 });
        if (listed.error) console.error("Hero decoration library query failed:", listed.error.message);
        else decorations = (listed.data || []).map((file) => ({ id: file.name.split(".")[0], storage_bucket: "template-assets", storage_path: `hero-decoration-library/${file.name}` })).filter((asset) => decorIds.has(asset.id));
      }
      templateConfig = templateConfig ? { ...templateConfig, hero: { ...templateConfig.hero, ...(heroPreset.config || {}), textLayers: [...(heroPreset.config?.textLayers || []), ...(Array.isArray(settings.heroExtraTextLayers) ? settings.heroExtraTextLayers.slice(0, 20) : [])].map((layer) => ({ ...layer, ...(settings.heroLayerOverrides?.[layer.id] || {}), text: typeof settings.heroTextOverrides?.[layer.id] === "string" ? settings.heroTextOverrides[layer.id].slice(0, 200) : layer.text })), frameAssetId: frame?.id || null } } : templateConfig;
      templateAssets = { ...templateAssets, ...Object.fromEntries(decorations.map((asset) => [asset.id, supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl])), ...(frame ? { [frame.id]: supabase.storage.from(frame.storage_bucket).getPublicUrl(frame.storage_path).data.publicUrl } : {}) };
    }
  }
  const { data: galleryRows, error: galleryError } = await supabase.from("event_media")
    .select("id,storage_path").eq("event_id", event.id).eq("gallery_state", "ready").order("sort_order").order("id").limit(20);
  // A missing migration must not take down an existing published invitation.
  if (galleryError) console.error("Gallery query failed:", galleryError.code);
  const galleryPhotos = (galleryRows || []).map(row => ({ id: row.id, url: supabase.storage.from("invitation-photos").getPublicUrl(row.storage_path).data.publicUrl }));

  const publicNotice = normalizeNotice(settings.notice);
  const waitForNoticeBeforeHeroIntro = publicNotice.enabled && Boolean(publicNotice.title) && Boolean(publicNotice.body);

  return <main className={`public-invitation shared-public-invitation${waitForNoticeBeforeHeroIntro ? " dd-hero-intro-waits-for-notice" : ""}`}>
    {ownerView && <nav className="owner-return-nav" aria-label="DearDay 관리 화면으로 돌아가기"><a href="/my-invitations">내 초대장</a><a href="/">DearDay 홈</a></nav>}
    <InvitationNotice notice={settings.notice} slug={slug} imageUrl={settings.notice?.imagePath ? supabase.storage.from("invitation-photos").getPublicUrl(settings.notice.imagePath).data.publicUrl : null} />
    <div className="full-invitation-renderer dd-bgm-public-style"><InvitationRenderer invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} templateId={invitation.templateId} templateConfig={templateConfig} templateAssets={templateAssets} userBgmUrl={userBgmUrl} placeActions={<><AddressCopy invitation={invitation} /><InvitationMap address={invitation.venueAddress} venue={invitation.venue} staticView /><TransportGuide invitation={invitation} /></>}>
      <div className="public-invitation-sections"><ParentsIntro invitation={invitation} eventKind={invitation.eventKind} /><GrowthTimeline invitation={invitation} eventKind={invitation.eventKind} /><Gallery photos={galleryPhotos} /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><OptionalInvitationSections invitation={invitation} slug={slug} startsAt={event.starts_at} /><LinkCopy path={`/invite/${slug}`} title={getInvitationTitle(invitation, invitation.eventKind)} imageUrl={invitation.kakaoShareImageUrl || invitation.coverPhotoUrl || templateAssets?.[templateConfig?.hero?.frameAssetId] || invitation.heroImageUrl || invitation.hero_image_url || galleryPhotos[0]?.url || ""} /><DearDayBrandFooter /></div>
    </InvitationRenderer></div>
</main>;
}
