"use client";

import RsvpForm from "./rsvp-form";
import Guestbook from "./guestbook";
import InvitationQuickMenu from "./invitation-quick-menu";

export default function OptionalInvitationSections({ invitation, slug = "", startsAt, preview = false, previewRoot = null, alwaysVisible = false, embedded = false }) {
  if (!preview) return <InvitationQuickMenu invitation={invitation} slug={slug} startsAt={startsAt} previewRoot={previewRoot} alwaysVisible={alwaysVisible} embedded={embedded} />;
  return <>
    {invitation.rsvpEnabled === true && <RsvpForm slug={slug} startsAt={startsAt} preview />}
    {invitation.guestbookEnabled !== false && <Guestbook slug={slug} preview />}
  </>;
}