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
  if (!preview) return <InvitationQuickMenu invitation={effectiveInvitation} slug={slug} startsAt={startsAt} previewMode={previewMode} />;
  return <>
    {effectiveInvitation.rsvpEnabled === true && <RsvpForm slug={slug} startsAt={startsAt} preview />}
    {effectiveInvitation.guestbookEnabled !== false && <Guestbook slug={slug} preview />}
  </>;
}