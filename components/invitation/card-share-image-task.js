"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import { runCardShareJob } from "../../lib/card-share-job";

export default function CardShareImageTask({ job, onResult }) {
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => {
    if (!job?.slug || !job.revision) { setStatus(""); setFailed(false); setBusy(false); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    let frame;
    let abortListener;
    const timeout = setTimeout(() => controller.abort(), 90000);
    setBusy(true); setFailed(false); setStatus("카카오 공유 이미지 생성 여부 확인 중…");
    const update = message => { if (!controller.signal.aborted) setStatus(message); };
    const work = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : {};
      if (!data?.session) throw new Error("로그인 상태를 확인한 후 다시 생성해 주세요.");
      return runCardShareJob({ job, token: data.session.access_token, signal: controller.signal, onStage: update,
        capture: async context => {
          const { browserHeroPng } = await import("../../lib/browser-hero-png");
          if (controller.signal.aborted) throw new DOMException("취소됨", "AbortError");
          frame = document.createElement("iframe");
          frame.title = "카드형 공유 이미지 생성"; frame.tabIndex = -1; frame.setAttribute("aria-hidden", "true");
          Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "390px", height: "844px", border: "0", pointerEvents: "none" });
          frame.onload = () => { if (frame.contentDocument) frame.contentDocument.documentElement.style.scrollbarWidth = "none"; };
          const path = `/invite/${encodeURIComponent(job.slug)}`;
          frame.src = `${path}?shareCapture=${encodeURIComponent(job.revision)}`;
          document.body.append(frame);
          return browserHeroPng(frame, path, { signal: controller.signal, onStage: update, expectedFingerprint: context.fingerprint, expectedRevision: job.revision });
        },
      });
    };
    const aborted = new Promise((_, reject) => {
      abortListener = () => reject(new DOMException("취소 또는 시간 초과", "AbortError"));
      controller.signal.addEventListener("abort", abortListener, { once: true });
    });
    Promise.race([work(), aborted]).then(result => {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      onResult?.(result.state === "saved" || result.state === "unchanged" || result.state === "not-card" ? result.state : "failed");
      setStatus(result.state === "saved" ? "카드형 카카오 공유 이미지를 저장했어요." : result.state === "unchanged" ? "기존 카드형 공유 이미지를 유지했어요." : result.state === "not-card" ? "자동 공유 이미지 생성이 건너뛰어졌어요. 저장된 HERO 설정이 카드형(illustration)으로 판별되지 않았습니다." : "공유 이미지 처리 결과를 확인하지 못했어요.");
    }).catch(error => {
      if (requestRef.current !== controller) return;
      onResult?.("failed");
      setFailed(true);
      setStatus(`초대장 발행·수정은 정상 반영됐어요. ${error.name === "AbortError" ? "이미지 생성 시간이 초과됐어요." : error.message} 기존 공유 이미지는 유지됩니다.`);
    }).finally(() => {
      clearTimeout(timeout); frame?.remove();
      controller.signal.removeEventListener("abort", abortListener);
      if (requestRef.current === controller) setBusy(false);
    });
    return () => { requestRef.current = null; controller.abort(); clearTimeout(timeout); frame?.remove(); };
  }, [job, retry]);
  if (!status) return null;
  return <div role="status" aria-live="polite" style={{ margin: "12px 0", fontSize: 13 }}><p>{status}</p>{failed && <button type="button" className="save-button" disabled={busy} onClick={() => setRetry(value => value + 1)}>공유 이미지 다시 생성</button>}</div>;
}
