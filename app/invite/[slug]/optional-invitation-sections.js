"use client";

import RsvpForm from "./rsvp-form";
import Guestbook from "./guestbook";

export default function OptionalInvitationSections({ invitation, slug = "", startsAt, preview = false }) {
  return <>
    {invitation.rsvpEnabled === true && <RsvpForm slug={slug} startsAt={startsAt} preview={preview} />}
    {invitation.guestbookEnabled !== false && <Guestbook slug={slug} preview={preview} />}
  </>;
}