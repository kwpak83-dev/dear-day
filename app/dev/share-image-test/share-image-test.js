"use client";
import { useEffect, useRef, useState } from "react";

export default function ShareImageTest() {
  const [slug, setSlug] = useState("");
  const [source, setSource] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [browserImage, setBrowserImage] = useState("");
  const [browserInfo, setBrowserInfo] = useState(null);
  const [browserStage, setBrowserStage] = useState("");
  const [browserBusy, setBrowserBusy] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const frameRef = useRef(null);
  const browserRequestRef = useRef(null);
  const requestRef = useRef(null);
  const [heroSize, setHeroSize] = useState(null);
  // Revoke only after React has removed the old image from the DOM.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  useEffect(() => () => { if (browserImage) URL.revokeObjectURL(browserImage); }, [browserImage]);
  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; browserRequestRef.current?.abort(); browserRequestRef.current = null; }, []);
  const resetComparison = value => {
    if (source !== value) { setImage(""); setBrowserImage(""); setBrowserInfo(null); setHeroSize(null); setError(""); setBrowserError(""); }
    setSource(value);
  };
  const generateBrowser = async () => {
    if (requestRef.current || browserRequestRef.current) return;
    const value = slug.trim();
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(value)) { setBrowserError("URL 전체 대신 초대장 slug만 입력해 주세요."); return; }
    const controller = new AbortController();
    browserRequestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    setBrowserBusy(true); setBrowserError(""); setBrowserImage(""); setBrowserInfo(null);
    resetComparison(value);
    let currentStage = "브라우저 준비";
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = () => reject(new DOMException("취소됨", "AbortError")); });
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    try {
      const result = await Promise.race([(async () => {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const { browserHeroPng } = await import("./browser-hero-png");
        return browserHeroPng(frameRef.current, `/invite/${encodeURIComponent(value)}`, {
          signal: controller.signal,
          onStage: name => { currentStage = name; setBrowserStage(name); },
        });
      })(), aborted]);
      if (controller.signal.aborted) return;
      setBrowserImage(URL.createObjectURL(result.blob));
      setBrowserInfo({ elapsedMs: result.elapsedMs, bytes: result.blob.size, resources: result.resourceCount, diagnostics: result.diagnostics });
      setHeroSize(result.heroSize);
      setBrowserStage("완료");
    } catch (failure) {
      if (browserRequestRef.current === controller) setBrowserError(`${currentStage}: ${controller.signal.aborted ? "취소 또는 90초 시간 초과" : failure.message || "변환 실패"}`);
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", rejectAbort);
      if (browserRequestRef.current === controller) { browserRequestRef.current = null; setBrowserBusy(false); }
    }
  };
  const generate = async event => {
    event.preventDefault();
    if (requestRef.current || browserRequestRef.current) return;
    const value = slug.trim();
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(value)) { setError("URL 전체 대신 초대장 slug만 입력해 주세요."); return; }
    setBusy(true); setError(""); resetComparison(value); setImage("");
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/dev/share-image-test?slug=${encodeURIComponent(value)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(`${result.stage || "요청"}: ${result.error || `HTTP ${response.status}`}`); }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const size = (response.headers.get("X-Hero-Size") || "").split("x").map(Number);
      setHeroSize(size.length === 2 && size.every(n => Number.isFinite(n) && n > 0) ? size : null);
      setImage(URL.createObjectURL(blob));
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    finally { if (requestRef.current === controller) { requestRef.current = null; setBusy(false); } }
  };
  return <main style={{ padding: 24, background: "#f2f2f2", minHeight: "100vh", color: "#222" }}>
    <h1>HERO 공유 이미지 검증 · 로컬 DEV 전용</h1>
    <p>발행 초대장의 실제 HERO를 캡처합니다. 저장되지 않은 편집 내용은 포함되지 않습니다. 기존 카카오 공유와는 연결되지 않습니다.</p>
    <p>인트로·등장 애니메이션은 완료 상태로 캡처하며, 전역 낙하 효과·공지 탭·음악 버튼·Quick Menu는 이미지에서 제외합니다.</p>
    <form onSubmit={generate} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <label>초대장 slug <input value={slug} disabled={busy || browserBusy} onChange={e => setSlug(e.target.value)} style={{ width: 360, maxWidth: "100%" }} /></label>
      <button disabled={busy || browserBusy}>{busy ? "Playwright 생성 중…" : "Playwright PNG 생성"}</button>
      <button type="button" onClick={generateBrowser} disabled={busy || browserBusy}>{browserBusy ? "브라우저 생성 중…" : "브라우저 PNG 생성"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {browserBusy && <p role="status">{browserStage}</p>}
    {browserError && <p role="alert">{browserError}</p>}
    <p>브라우저 방식은 CORS를 우회하지 않습니다. 마스크·그라데이션·그림자·한글 폰트의 동일성은 두 결과를 비교해 확인해 주세요.</p>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginTop: 24 }}>
      {source && <section style={{ flex: "0 0 390px", overflow: "auto", maxWidth: "100%" }}><h2>원본 · 390px</h2><iframe ref={frameRef} title="원본 초대장 HERO 비교" onLoad={event => { const doc = event.currentTarget.contentDocument; if (doc) doc.documentElement.style.scrollbarWidth = "none"; }} src={`/invite/${encodeURIComponent(source)}`} style={{ width: 390, height: 800, border: 0 }} /></section>}
      {(image || browserImage) && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 16, flex: "1 1 640px", minWidth: 0 }}>
      {image && <section style={{ minWidth: 0 }}><h2>Playwright PNG · 1200×630</h2><img src={image} alt="실제 HERO 기반 공유 이미지" style={{ width: "100%", maxWidth: 1200 }} /><a href={image} download="dearday-hero-share-test.png">Playwright PNG 저장</a></section>}
      {browserImage && <section style={{ flex: "1 1 600px", minWidth: 0 }}><h2>브라우저 PNG · 1200×630</h2><img src={browserImage} alt="브라우저에서 변환한 HERO 공유 이미지" style={{ width: "100%", maxWidth: 1200 }} /><a href={browserImage} download="dearday-hero-browser-test.png">브라우저 PNG 저장</a><p>{browserInfo?.elapsedMs}ms · {browserInfo?.bytes.toLocaleString()} bytes · 리소스 {browserInfo?.resources}개</p><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(browserInfo?.diagnostics)}</pre></section>}
      </div>}
      {image && heroSize && <section><h2>생성 HERO 확대 · 원본과 같은 390px</h2><p>PNG의 중앙 HERO를 확대합니다. 축소 PNG의 해상도 차이는 있습니다.</p><div style={{width:390,height:390*heroSize[1]/heroSize[0],overflow:"hidden",position:"relative"}}><img src={image} alt="생성 PNG의 HERO 동일 폭 비교" style={{position:"absolute",maxWidth:"none",width:1200*390/(heroSize[0]*Math.min(1200/heroSize[0],630/heroSize[1])),height:630*390/(heroSize[0]*Math.min(1200/heroSize[0],630/heroSize[1])),left:"50%",top:"50%",transform:"translate(-50%,-50%)"}}/></div></section>}
    </div>
  </main>;
}
