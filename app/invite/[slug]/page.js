import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import AccountCopy from "./account-copy";

export default async function InvitationPage({ params }) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) notFound();
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: events } = await supabase.from("events").select("title,starts_at,settings").eq("slug", slug).eq("status", "published").limit(1);
  const event = events?.[0];
  if (!event) notFound();
  const invitation = event.settings || {};
  const date = event.starts_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "full", timeStyle: "short" }).format(new Date(event.starts_at)) : "";
  return <main className="public-invitation"><p>WEDDING INVITATION</p><div className="public-flower">✿ &nbsp; ❋ &nbsp; ✿</div><div className="public-photo">{invitation.coverPhotoUrl ? <img src={invitation.coverPhotoUrl} alt={`${invitation.groom || "신랑"} · ${invitation.bride || "신부"}의 대표사진`} /> : <>{invitation.groom?.slice(0, 1)} &amp; {invitation.bride?.slice(0, 1)}</>}</div><h1>{invitation.groom} <em>&amp;</em> {invitation.bride}</h1><time>{date}</time><hr /><strong>{invitation.venue}</strong>{invitation.venueAddress && <span>{invitation.venueAddress}</span>}<blockquote>{invitation.message}</blockquote><AccountCopy invitation={invitation} /><footer>디어데이와 함께하는 소중한 순간</footer></main>;
}
