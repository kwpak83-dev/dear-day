"use client";

import { useRef, useState } from "react";

// Isolated browser DOM-capture feasibility probe. It never reads invitations,
// accesses Supabase, or changes the Kakao share flow.
export default function HeroCaptureProbe() {
  const heroRef = useRef(null);
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState("");

  async function capture() {
    setResult("Capturing...");
    try {
      if (!heroRef.current) throw new Error("Hero element missing");
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      // Draw a safe, synthetic sample directly on canvas.
      // This tests export reliability only; it is NOT DOM/HERO capture.
      ctx.fillStyle = "#e8ddd2";
      ctx.fillRect(0, 0, 1200, 630);
      const x = 423, y = 0, w = 354, h = 630;
      ctx.fillStyle = "#fff8f1";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#bda591";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = "#c8a78f";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 23, y + 24, w - 46, h - 48);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#513b33";
      ctx.font = "23px Arial, sans-serif";
      ctx.fillText("The Wedding of", 600, 105);
      ctx.font = "34px Arial, sans-serif";
      ctx.fillText("우리의 결혼식", 600, 285);
      ctx.font = "30px Arial, sans-serif";
      ctx.fillText("정우 ♡ 수지", 600, 360);
      ctx.font = "19px Arial, sans-serif";
      ctx.fillText("2026. 11. 21", 600, 448);
      ctx.font = "18px Arial, sans-serif";
      ctx.fillText("DEARDAY", 600, 558);
      setPreview(canvas.toDataURL("image/png"));
      setResult("Direct Canvas PNG export succeeded. Actual DOM/HERO capture is NOT yet supported or validated.");
    } catch (error) {
      setResult(`Capture failed: ${error.message}`);
    }
  }

  return <main style={{ padding: 24, background: "#e8ddd2", color: "#513b33", fontFamily: "Arial,sans-serif" }}>
    <h1>DearDay Canvas PNG export feasibility probe</h1>
    <p>Preview-only experiment. No invitation data or share settings are changed.</p>
    <div ref={heroRef} style={{ width: 360, height: 640, background: "#fff8f1", border: "3px solid #bda591", boxSizing: "border-box", marginBottom: 20, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 20, border: "1px solid #c8a78f" }} />
      <div style={{ position: "absolute", top: 70, fontSize: 23 }}>The Wedding of</div>
      <div style={{ fontSize: 34 }}>우리의 결혼식</div>
      <div style={{ fontSize: 30, marginTop: 30 }}>정우 ♡ 수지</div>
      <div style={{ fontSize: 20, marginTop: 45 }}>2026. 11. 21</div>
      <div style={{ position: "absolute", bottom: 55, fontSize: 18 }}>DEARDAY</div>
    </div>
    <button type="button" onClick={capture} style={{ padding: "12px 18px", background: "#513b33", color: "white", border: 0, borderRadius: 6 }}>Run direct Canvas export probe</button>
    <p role="status">{result}</p>
    {preview && <div><p>Generated 1200 × 630 image:</p><img src={preview} alt="Canvas-generated synthetic test composition" style={{ maxWidth: "100%" }} /><p><a href={preview} download="dearday-browser-probe.png">Download PNG</a></p></div>}
  </main>;
}
