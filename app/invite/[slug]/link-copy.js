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

export default function LinkCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await writeToClipboard(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <div className="public-share-copy"><button type="button" onClick={copy}>링크 복사</button><span role="status" aria-live="polite">{copied ? "초대장 링크가 복사되었습니다." : ""}</span></div>;
}