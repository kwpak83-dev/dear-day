"use client";

import RsvpForm from "./rsvp-form";
import Guestbook from "./guestbook";
import InvitationQuickMenu from "./invitation-quick-menu";

export default function OptionalInvitationSections({ invitation, eventTypeConfig, slug = "", startsAt, preview = false, previewMode = "" }) {
  const fields = eventTypeConfig?.fields || {};
  const rsvpState = fields.rsvp?.state;
  const guestbookState = fields.guestbook?.state;
  const effectiveInvitation = {
    ...invitation,
    rsvpEnabled: rsvpState === "none" ? false : rsvpState === "required" ? true : invitation.rsvpEnabled,
    guestbookEnabled: guestbookState === "none" ? false : guestbookState === "required" ? true : invitation.guestbookEnabled,
  };
  const rsvpLabel = String(fields.rsvp?.label || "참석 여부").trim() || "참석 여부";
  const guestbookLabel = String(fields.guestbook?.label || "방명록").trim() || "방명록";
  if (!preview) return <InvitationQuickMenu invitation={effectiveInvitation} slug={slug} startsAt={startsAt} previewMode={previewMode} rsvpLabel={rsvpLabel} guestbookLabel={guestbookLabel} />;
  return <>
    {effectiveInvitation.rsvpEnabled === true && <RsvpForm slug={slug} startsAt={startsAt} preview title={rsvpLabel} />}
    {effectiveInvitation.guestbookEnabled !== false && <Guestbook slug={slug} preview title={guestbookLabel} />}
  </>;
}