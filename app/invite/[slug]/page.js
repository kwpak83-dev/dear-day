import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import InvitationMap from "../../../components/invitation/invitation-map";
import Gallery from "./gallery";
import AccountCopy from "./account-copy";
import AddressCopy from "./address-copy";
import LinkCopy from "./link-copy";
import OptionalInvitationSections from "./optional-invitation-sections";
import { getInvitationTitle } from "../../../lib/invitation-title";
import { isPublicPeriodExpired } from "../../../lib/invitation-retention";
import { getTemplateAssetReferences } from "../../../lib/template-config";

export default async function InvitationPage({ params, searchParams }) {
  const { slug } = await params;
  const ownerView = (await searchParams)?.from === "owner";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) notFound();
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: events } = await supabase.from("events").select("id,status,kind,template_id,template_version_id,starts_at,service_expires_at,grace_ends_at,settings").eq("slug", slug).in("status", ["published", "suspended"]).limit(1);
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
  let templateConfig = null;
  let templateAssets = {};
  if (event.template_id && event.template_version_id) {
    const { data: pinnedVersion, error: versionError } = await supabase.from("template_versions")
      .select("id,template_id,status,config").eq("id", event.template_version_id)
      .eq("template_id", event.template_id).maybeSingle();
    if (versionError) console.error("Pinned template version query failed:", versionError.code);
    if (pinnedVersion && pinnedVersion.status !== "draft") {
      templateConfig = pinnedVersion.config;
      const references = getTemplateAssetReferences(templateConfig);
      if (references.length) {
        const expectedTypes = new Map(references.map((item) => [item.id, item.type]));
        const { data: assets, error: assetError } = await supabase.from("template_assets")
          .select("id,template_id,asset_type,storage_bucket,storage_path")
          .eq("template_id", event.template_id).in("id", [...expectedTypes.keys()]);
        if (assetError) console.error("Pinned template asset query failed:", assetError.code);
        templateAssets = Object.fromEntries((assets || []).filter((asset) =>
          asset.template_id === event.template_id && asset.storage_bucket === "template-assets" &&
          typeof asset.storage_path === "string" && asset.storage_path.startsWith(`${event.template_id}/`) &&
          expectedTypes.get(asset.id) === asset.asset_type
        ).map((asset) => [asset.id, supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl]));
      }
    }
  }
  const { data: galleryRows, error: galleryError } = await supabase.from("event_media")
    .select("id,storage_path").eq("event_id", event.id).eq("gallery_state", "ready").order("sort_order").order("id").limit(20);
  // A missing migration must not take down an existing published invitation.
  if (galleryError) console.error("Gallery query failed:", galleryError.code);
  const galleryPhotos = (galleryRows || []).map(row => ({ id: row.id, url: supabase.storage.from("invitation-photos").getPublicUrl(row.storage_path).data.publicUrl }));

  return <main className="public-invitation shared-public-invitation">
    {ownerView && <nav className="owner-return-nav" aria-label="DearDay 관리 화면으로 돌아가기"><a href="/my-invitations">내 초대장</a><a href="/">DearDay 홈</a></nav>}
    <div className="full-invitation-renderer"><InvitationRenderer invitation={invitation} eventKind={invitation.eventKind} templateId={invitation.templateId} templateConfig={templateConfig} templateAssets={templateAssets} placeActions={<><AddressCopy invitation={invitation} /><InvitationMap address={invitation.venueAddress} /></>}>
      <div className="public-invitation-sections"><Gallery photos={galleryPhotos} /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><OptionalInvitationSections invitation={invitation} slug={slug} startsAt={event.starts_at} /><LinkCopy path={`/invite/${slug}`} title={getInvitationTitle(invitation, invitation.eventKind)} /><footer>디어데이와 함께하는 소중한 순간</footer></div>
    </InvitationRenderer></div>
  </main>;
}
