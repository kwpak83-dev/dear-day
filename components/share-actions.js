"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";

export async function writeToClipboard(value) {
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

export default function ShareActions({ path, title = "DearDay 초대장", text, className = "", showPath = false, previewOnly = false }) {
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const noticeTimer = useRef(null);
  const qrHistoryRef = useRef(null);

  useEffect(() => {
    const onPopState = () => {
      if (!qrHistoryRef.current) return;
      qrHistoryRef.current = null;
      setQrOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const closeQr = () => {
    const token = qrHistoryRef.current;
    qrHistoryRef.current = null;
    setQrOpen(false);
    if (token && window.history.state?.ddInvitationQr === token) window.history.back();
  };

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    if (!qrOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [qrOpen]);

  const publicUrl = () => new URL(path, window.location.origin).toString();
  const showNotice = (message, isCopied = false) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    setCopied(isCopied);
    noticeTimer.current = window.setTimeout(() => { setNotice(""); setCopied(false); }, 2200);
  };
  const copy = async (fallback = false) => {
    if (previewOnly) return showNotice("미리보기입니다. 발행 후 공유할 수 있어요.");
    try {
      await writeToClipboard(publicUrl());
      showNotice(fallback ? "공유 기능을 지원하지 않아 링크를 복사했습니다." : "링크가 복사되었습니다.", true);
    } catch {
      showNotice("링크를 복사하지 못했습니다. 다시 시도해 주세요.");
    }
  };
  const share = async () => {
    if (previewOnly) return showNotice("미리보기입니다. 발행 후 공유할 수 있어요.");
    if (!navigator.share) return copy(true);
    try {
      await navigator.share({ title, url: publicUrl() });
      showNotice("공유를 완료했습니다.");
    } catch (error) {
      if (error?.name !== "AbortError") showNotice("공유하지 못했습니다. 다시 시도해 주세요.");
    }
  };
  const openQr = async () => {
    if (previewOnly) return showNotice("미리보기입니다. 발행 후 QR 코드를 사용할 수 있어요.");
    const url = publicUrl();
    if (!qrHistoryRef.current) {
      const token = `dd-invitation-qr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.history.pushState({ ...window.history.state, ddInvitationQr: token }, "", window.location.href);
      qrHistoryRef.current = token;
    }
    setQrOpen(true);
    setQrUrl(url);
    setQrDataUrl("");
    setQrError("");
    try {
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", width: 320, margin: 4, color: { dark: "#000000", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError("QR 코드를 만들지 못했습니다. 다시 시도해 주세요.");
    }
  };
  const saveQr = () => {
    if (!qrDataUrl) return;
    try {
      const link = document.createElement("a");
      link.href = qrDataUrl;
      link.download = "dearday-invitation-qr.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setQrError("QR 이미지를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return <>
    {showPath && <div className="share-link"><span>{path}</span><button type="button" onClick={() => copy()}>{copied ? "복사됨" : "링크 복사"}</button></div>}
    <div className={`${className.includes("public-share-copy") ? "dd-public-share-pills" : "share-actions"} ${className}`.trim()}>
      {className.includes("public-share-copy") ? <>
        <button type="button" className="dd-share-kakao" onClick={share}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.4 2 10.7c0 2.8 1.9 5.3 4.8 6.7L6 21l4.2-2.5c.6.1 1.2.1 1.8.1 5.5 0 10-3.5 10-7.9S17.5 3 12 3z"/></svg>카톡공유</button>
        <button type="button" className="dd-share-link" onClick={() => copy()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>링크복사</button>
        <button type="button" className="dd-share-qr" onClick={openQr}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm10-2h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3z"/></svg>QR코드</button>
      </> : <>
        {!showPath && <button type="button" onClick={() => copy()}>링크 복사</button>}
        <button type="button" onClick={share}>공유하기</button>
        <button type="button" onClick={openQr}>QR 코드</button>
      </>}
      <span className="share-actions-notice" role="status" aria-live="polite">{notice}</span>
    </div>
    {qrOpen && createPortal(<div className="qr-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title" onKeyDown={(event) => { if (event.key === "Escape") closeQr(); }}>
      <div className="qr-modal">
        <button type="button" className="qr-modal-close" aria-label="QR 코드 닫기" onClick={closeQr} autoFocus>×</button>
        <p className="section-kicker">DEARDAY</p>
        <h2 id="qr-modal-title">초대장 QR 코드</h2>
        <div className="qr-image-frame">{qrDataUrl ? <img src={qrDataUrl} alt="공개 초대장 QR 코드" width="320" height="320" /> : !qrError && <span>QR 코드를 만들고 있어요.</span>}</div>
        {qrError ? <p className="qr-modal-error" role="alert">{qrError}</p> : <><p>스마트폰 카메라로 스캔해<br />초대장을 확인할 수 있습니다.</p><span className="qr-public-url">{qrUrl}</span></>}
        <div className="qr-modal-actions"><button type="button" className="save-button" onClick={closeQr}>닫기</button><button type="button" className="publish-button" onClick={saveQr} disabled={!qrDataUrl}>QR 이미지 저장</button></div>
      </div>
    </div>, document.body)}
  </>;
}
