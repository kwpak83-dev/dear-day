import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import Gallery from "./gallery";
import AccountCopy from "./account-copy";
import AddressCopy from "./address-copy";

export default async function InvitationPage({ params }) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) notFound();
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: events } = await supabase.from("events").select("id,kind,template_id,settings").eq("slug", slug).eq("status", "published").limit(1);
  const event = events?.[0];
  if (!event) notFound();
  const settings = event.settings || {};
  const invitation = {
    ...settings,
    eventKind: event.kind || settings.eventKind || "wedding",
    templateId: event.template_id || settings.templateId || "",
  };
  const { data: galleryRows, error: galleryError } = await supabase.from("event_media")
    .select("id,storage_path").eq("event_id", event.id).eq("gallery_state", "ready").order("sort_order").order("id").limit(20);
  // A missing migration must not take down an existing published invitation.
  if (galleryError) console.error("Gallery query failed:", galleryError.code);
  const galleryPhotos = (galleryRows || []).map(row => ({ id: row.id, url: supabase.storage.from("invitation-photos").getPublicUrl(row.storage_path).data.publicUrl }));

  return <main className="public-invitation shared-public-invitation">
    <div className="full-invitation-renderer"><InvitationRenderer invitation={invitation} eventKind={invitation.eventKind} templateId={invitation.templateId} placeActions={<AddressCopy invitation={invitation} />}>
      <div className="public-invitation-sections"><Gallery photos={galleryPhotos} /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><footer>디어데이와 함께하는 소중한 순간</footer></div>
    </InvitationRenderer></div>
  </main>;
}
