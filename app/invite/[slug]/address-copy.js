"use client";

import { useState } from "react";

async function writeToClipboard(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function AddressCopy({ invitation }) {
  const [copied, setCopied] = useState(false);
  const address = [invitation.venueAddress, invitation.venueBuilding, invitation.venueDetail]
    .map(value => value?.trim()).filter(Boolean).join(" ");
  if (!address) return null;

  const copy = async () => {
    await writeToClipboard(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <div className="public-address-copy"><button type="button" onClick={copy}>주소 복사</button><span role="status" aria-live="polite">{copied ? "주소가 복사되었습니다." : ""}</span></div>;
}
