"use client";

import { useLayoutEffect, useRef } from "react";

/** Grow to the actual wrapped text height, including explicit newlines. */
export default function AutoHeightMessageTextarea({ value, onChange }) {
  const textareaRef = useRef(null);
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    const target = Math.min(360, Math.max(68, element.scrollHeight));
    element.style.height = `${target}px`;
    element.style.overflowY = element.scrollHeight > 360 ? "auto" : "hidden";
  }, [value]);
  return <textarea
    ref={textareaRef}
    className="dd-invitation-message-textarea dd-invitation-message-textarea--auto"
    rows={2}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    aria-label="초대 문구 줄바꿈 편집"
    style={{ resize: "none" }}
  />;
}
