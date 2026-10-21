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
      const node = heroRef.current;
      if (!node) throw new Error("Hero element missing");
      await document.fonts.ready;
      const width = 360;
      const height = 640;
      const styles = getComputedStyle(node);
      const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;box-sizing:border-box;background:${styles.backgroundColor};font-family:Arial,sans-serif"><div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px solid #bda591;box-sizing:border-box;color:#513b33"><div style="position:absolute;inset:20px;border:1px solid #c8a78f"></div><div style="position:absolute;top:70px;font-size:23px">The Wedding of</div><div style="font-size:34px">우리의 결혼식</div><div style="font-size:30px;margin-top:30px">정우 ♡ 수지</div><div style="font-size:20px;margin-top:45px">2026. 11. 21</div><div style="position:absolute;bottom:55px;font-size:18px">DEARDAY</div></div></div></foreignObject></svg>`;
      const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      try {
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("SVG foreignObject image decoding failed"));
          image.src = objectUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 630;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = "#e8ddd2";
        context.fillRect(0, 0, 1200, 630);
        context.drawImage(image, 423, 0, 354, 630);
        setPreview(canvas.toDataURL("image/png"));
        setResult("Browser SVG/Canvas composition succeeded. This is not yet a pixel-perfect DOM screenshot.");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      setResult(`Capture failed: ${error.message}`);
    }
  }

  return <main style={{ padding: 24, background: "#e8ddd2", color: "#513b33", fontFamily: "Arial,sans-serif" }}>
    <h1>DearDay HERO capture feasibility probe</h1>
    <p>Preview-only experiment. No invitation data or share settings are changed.</p>
    <div ref={heroRef} style={{ width: 360, height: 640, background: "#fff8f1", border: "3px solid #bda591", boxSizing: "border-box", marginBottom: 20, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 20, border: "1px solid #c8a78f" }} />
      <div style={{ position: "absolute", top: 70, fontSize: 23 }}>The Wedding of</div>
      <div style={{ fontSize: 34 }}>우리의 결혼식</div>
      <div style={{ fontSize: 30, marginTop: 30 }}>정우 ♡ 수지</div>
      <div style={{ fontSize: 20, marginTop: 45 }}>2026. 11. 21</div>
      <div style={{ position: "absolute", bottom: 55, fontSize: 18 }}>DEARDAY</div>
    </div>
    <button type="button" onClick={capture} style={{ padding: "12px 18px", background: "#513b33", color: "white", border: 0, borderRadius: 6 }}>Run browser composition probe</button>
    <p role="status">{result}</p>
    {preview && <div><p>Generated 1200 × 630 image:</p><img src={preview} alt="Browser-generated test composition" style={{ maxWidth: "100%" }} /><p><a href={preview} download="dearday-browser-probe.png">Download PNG</a></p></div>}
  </main>;
}
