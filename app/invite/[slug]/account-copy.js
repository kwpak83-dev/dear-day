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
    await writeToClipboard([bank, account].filter(Boolean).join(" "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <article className="public-account-card"><p>{side}</p><strong className="public-account-holder">예금주 : {holder}</strong><div><span className="public-account-bank">{bankLogo && <img src={bankLogo} alt="" />}<span>{[bank, account].filter(Boolean).join(" ")}</span></span><button type="button" onClick={copy}>{copied ? "복사됨" : "계좌 복사"}</button></div></article>;
}

export default function AccountCopy({ invitation, eventKind }) {
  const accountMode = getEventConfig(eventKind).accountMode;
  const groomAccount = invitation.groomAccount?.trim();
  const brideAccount = invitation.brideAccount?.trim();
  const parents = accountMode === "parents";
  if (!accountMode) return null;
  if (parents) {
    if (!groomAccount && !brideAccount) return null;
    return <section className="public-accounts"><h2>마음 전하실 곳</h2>{groomAccount&&<AccountCard side="부모/보호자 1" bank={invitation.groomBank} holder={invitation.groomAccountHolder||invitation.parent1Name||"예금주"} account={groomAccount}/>} {brideAccount&&<AccountCard side="부모/보호자 2" bank={invitation.brideBank} holder={invitation.brideAccountHolder||invitation.parent2Name||"예금주"} account={brideAccount}/>}</section>;
  }
  const groomSide=[["신랑",invitation.groomBank,invitation.groomAccountHolder||invitation.groom, groomAccount],["신랑 아버지",invitation.groomFatherBank,invitation.groomFatherAccountHolder||invitation.groomFatherName,invitation.groomFatherAccount?.trim()],["신랑 어머니",invitation.groomMotherBank,invitation.groomMotherAccountHolder||invitation.groomMotherName,invitation.groomMotherAccount?.trim()]].filter(([, , ,account])=>account);
  const brideSide=[["신부",invitation.brideBank,invitation.brideAccountHolder||invitation.bride, brideAccount],["신부 아버지",invitation.brideFatherBank,invitation.brideFatherAccountHolder||invitation.brideFatherName,invitation.brideFatherAccount?.trim()],["신부 어머니",invitation.brideMotherBank,invitation.brideMotherAccountHolder||invitation.brideMotherName,invitation.brideMotherAccount?.trim()]].filter(([, , ,account])=>account);
  if (!groomSide.length && !brideSide.length) return null;
  const Side=({title,rows})=>rows.length?<details className="public-account-side"><summary>{title}<span aria-hidden="true">⌄</span></summary>{rows.map(([side,bank,holder,account])=><AccountCard key={side} side={side} bank={bank} holder={holder||"예금주"} account={account}/>)}</details>:null;
  return <section className="public-accounts"><h2>마음 전하실 곳</h2><Side title="신랑측" rows={groomSide}/><Side title="신부측" rows={brideSide}/></section>;
}
