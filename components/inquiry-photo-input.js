"use client";

import { useEffect, useRef, useState } from "react";
import { INQUIRY_MAX_FILES } from "../lib/inquiry-policy";
import { prepareInquiryPhoto } from "../lib/prepare-inquiry-photo";

function Thumbnail({ file, index }) {
  const image = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={`등록할 사진 ${index + 1}`} />;
}

export default function InquiryPhotoInput({ files, setFiles, disabled, onBusy }) {
  const input = useRef(null);
  const processing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (incoming) => {
    if (!incoming.length || processing.current || disabled) return;
    if (files.length + incoming.length > INQUIRY_MAX_FILES) {
      setError("사진은 최대 3장까지 첨부할 수 있어요.");
      return;
    }
    setError("");
    processing.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const optimized = [];
      for (const file of incoming) optimized.push(await prepareInquiryPhoto(file));
      setFiles(current => [...current, ...optimized].slice(0, INQUIRY_MAX_FILES));
    } catch (error) { setError(error.message); }
    finally {
      processing.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  useEffect(() => {
    const paste = event => {
      const images = [...(event.clipboardData?.items || [])].filter(item => item.kind === "file" && item.type.startsWith("image/"))
        .map(item => item.getAsFile()).filter(Boolean);
      if (!images.length || disabled || processing.current || document.querySelector("dialog[open]")) return;
      if (!event.clipboardData.getData("text/plain")) event.preventDefault();
      void add(images);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  });
  return <fieldset className="inquiry-photo-input" onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
    onDrop={event => {
      if (!event.dataTransfer.files.length) return;
      event.preventDefault();
      void add([...event.dataTransfer.files]);
    }}>
    <legend>사진 첨부 (선택) · {files.length} / {INQUIRY_MAX_FILES}</legend>
    <input hidden ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="문의에 첨부할 사진"
      onChange={event => { const chosen = [...event.target.files]; event.target.value = ""; void add(chosen); }} />
    <button type="button" onClick={() => input.current?.click()} disabled={disabled || busy || files.length === INQUIRY_MAX_FILES}>사진 추가</button>
    <p>최대 3장 · 장당 5MB 이하<br />JPG, PNG, WebP 파일을 첨부할 수 있어요.<br />사진은 자동으로 용량이 최적화됩니다.</p>
    <p className="inquiry-photo-desktop-help">사진을 붙여넣거나 이 영역으로 끌어다 놓으세요.</p>
    {busy && <p role="status">사진을 최적화하고 있어요.</p>}
    {error && <p role="alert">{error}</p>}
    {!!files.length && <div className="inquiry-photo-grid">{files.map((file, index) =>
      <div className="inquiry-photo-tile" key={index}><Thumbnail file={file} index={index} />
        <button type="button" disabled={disabled || busy} aria-label={`사진 ${index + 1} 제거`} onClick={() => { setError(""); setFiles(current => current.filter((_, i) => i !== index)); }}>×</button>
      </div>)}</div>}
  </fieldset>;
}
