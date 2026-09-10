"use client";

import { useState } from "react";

async function writeToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function AccountCard({ side, bank, holder, account }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await writeToClipboard(account);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <article className="public-account-card"><p>{side}</p><strong>{bank || "계좌 안내"} · {holder}</strong><div><span>{account}</span><button type="button" onClick={copy}>{copied ? "복사됨" : "계좌 복사"}</button></div></article>;
}

export default function AccountCopy({ invitation }) {
  const groomAccount = invitation.groomAccount?.trim();
  const brideAccount = invitation.brideAccount?.trim();
  if (!groomAccount && !brideAccount) return null;

  return <section className="public-accounts"><h2>마음 전하실 곳</h2>{groomAccount && <AccountCard side="신랑 측" bank={invitation.groomBank} holder={invitation.groomAccountHolder || invitation.groom || "신랑"} account={groomAccount} />}{brideAccount && <AccountCard side="신부 측" bank={invitation.brideBank} holder={invitation.brideAccountHolder || invitation.bride || "신부"} account={brideAccount} />}</section>;
}
