"use client";

import { useState } from "react";
import { getBankLogo } from "../../../lib/bank-options";
import { getEventAccountGroups } from "../../../lib/event-account-groups";

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
    await writeToClipboard([bank, account].filter(Boolean).join(" "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <article className="public-account-card"><p>{side}</p><strong className="public-account-holder">예금주 : {holder}</strong><div><span className="public-account-bank">{bankLogo && <img src={bankLogo} alt="" />}<span>{[bank, account].filter(Boolean).join(" ")}</span></span><button type="button" onClick={copy}>{copied ? "복사됨" : "계좌 복사"}</button></div></article>;
}

export default function AccountCopy({ invitation, eventKind, eventTypeConfig, previewExpanded = false }) {
  const accountConfig = getEventAccountGroups(eventKind, eventTypeConfig);
  if (!accountConfig.enabled) return null;
  if (eventKind !== "wedding") {
    const rows = accountConfig.groups.map((group) => ({
      ...group,
      account: invitation[group.accountKey]?.trim(),
    })).filter((group) => group.account);
    if (!rows.length) return null;
    return <section className="public-accounts"><h2>{accountConfig.sectionLabel}</h2>{rows.map((group) => <AccountCard key={group.key} side={group.renderLabel} bank={invitation[group.bankKey]} holder={invitation[group.holderKey]||invitation[group.nameKey]||"예금주"} account={group.account}/>)}</section>;
  }
  const groomAccount = invitation.groomAccount?.trim();
  const brideAccount = invitation.brideAccount?.trim();
  const groomSide=[["신랑",invitation.groomBank,invitation.groomAccountHolder||invitation.groom, groomAccount],["신랑 아버지",invitation.groomFatherBank,invitation.groomFatherAccountHolder||invitation.groomFatherName,invitation.groomFatherAccount?.trim()],["신랑 어머니",invitation.groomMotherBank,invitation.groomMotherAccountHolder||invitation.groomMotherName,invitation.groomMotherAccount?.trim()]].filter(([, , ,account])=>account);
  const brideSide=[["신부",invitation.brideBank,invitation.brideAccountHolder||invitation.bride, brideAccount],["신부 아버지",invitation.brideFatherBank,invitation.brideFatherAccountHolder||invitation.brideFatherName,invitation.brideFatherAccount?.trim()],["신부 어머니",invitation.brideMotherBank,invitation.brideMotherAccountHolder||invitation.brideMotherName,invitation.brideMotherAccount?.trim()]].filter(([, , ,account])=>account);
  if (!groomSide.length && !brideSide.length) return null;
  const Side=({title,rows})=>Array.isArray(rows)&&rows.length?<details className="public-account-side" open={previewExpanded || undefined}><summary>{title}<span aria-hidden="true">⌄</span></summary>{rows.map(([side,bank,holder,account])=><AccountCard key={side} side={side} bank={bank} holder={holder||"예금주"} account={account}/>)}</details>:null;
  const rowsByGroup = { groom: groomSide, bride: brideSide };
  return <section className="public-accounts"><h2>{accountConfig.sectionLabel}</h2>{accountConfig.groups.map((group) => <Side key={group.key} title={group.renderLabel} rows={rowsByGroup[group.key]}/>)}</section>;
}
