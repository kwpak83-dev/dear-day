"use client";

import { useState } from "react";
import { getEventConfig } from "../../../lib/event-config";
import { getBankLogo } from "../../../lib/bank-options";

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
  const bankLogo = getBankLogo(bank);
  const copy = async () => {
    await writeToClipboard(account);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <article className="public-account-card"><p>{side}</p><strong className="public-account-bank">{bankLogo && <img src={bankLogo} alt="" />}<span>{bank || "계좌 안내"} · {holder}</span></strong><div><span>{account}</span><button type="button" onClick={copy}>{copied ? "복사됨" : "계좌 복사"}</button></div></article>;
}

export default function AccountCopy({ invitation, eventKind }) {
  const accountMode = getEventConfig(eventKind).accountMode;
  const groomAccount = invitation.groomAccount?.trim();
  const brideAccount = invitation.brideAccount?.trim();
  if (!accountMode || (!groomAccount && !brideAccount)) return null;
  const parents = accountMode === "parents";

  return <section className="public-accounts"><h2>마음 전하실 곳</h2>{groomAccount && <AccountCard side={parents ? "부모/보호자 1" : "신랑 측"} bank={invitation.groomBank} holder={invitation.groomAccountHolder || (parents ? invitation.parent1Name : invitation.groom) || "예금주"} account={groomAccount} />}{brideAccount && <AccountCard side={parents ? "부모/보호자 2" : "신부 측"} bank={invitation.brideBank} holder={invitation.brideAccountHolder || (parents ? invitation.parent2Name : invitation.bride) || "예금주"} account={brideAccount} />}</section>;
}
