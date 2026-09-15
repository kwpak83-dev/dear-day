"use client";

import { useEffect, useRef, useState } from "react";

async function writeToClipboard(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

export default function ShareActions({ path, title = "DearDay 초대장", text, className = "", showPath = false }) {
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const noticeTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const publicUrl = () => new URL(path, window.location.origin).toString();
  const showNotice = (message, isCopied = false) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    setCopied(isCopied);
    noticeTimer.current = window.setTimeout(() => { setNotice(""); setCopied(false); }, 2200);
  };
  const copy = async (fallback = false) => {
    try {
      await writeToClipboard(publicUrl());
      showNotice(fallback ? "공유 기능을 지원하지 않아 링크를 복사했습니다." : "링크가 복사되었습니다.", true);
    } catch {
      showNotice("링크를 복사하지 못했습니다. 다시 시도해 주세요.");
    }
  };
  const share = async () => {
    if (!navigator.share) return copy(true);
    try {
      await navigator.share({ title, text: text || `${title}을 확인해 주세요.`, url: publicUrl() });
      showNotice("공유를 완료했습니다.");
    } catch (error) {
      if (error?.name !== "AbortError") showNotice("공유하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return <>
    {showPath && <div className="share-link"><span>{path}</span><button type="button" onClick={() => copy()}>{copied ? "복사됨" : "링크 복사"}</button></div>}
    <div className={`share-actions ${className}`.trim()}>
      {!showPath && <button type="button" onClick={() => copy()}>링크 복사</button>}
      <button type="button" onClick={share}>공유하기</button>
      <span className="share-actions-notice" role="status" aria-live="polite">{notice}</span>
    </div>
  </>;
}
