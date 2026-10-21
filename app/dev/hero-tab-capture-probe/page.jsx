"use client";

import { useRef, useState } from "react";

// Explicit-consent browser tab capture feasibility test. No uploads or database writes.
// Only captures after the user chooses to share this tab in the browser picker.
export default function HeroTabCaptureProbe() {
  const heroRef = useRef(null);
  const [status, setStatus] = useState("Not tested");
  const [png, setPng] = useState("");

  async function capture() {
    setPng("");
    setStatus("Waiting for browser tab-sharing permission...");
    let stream;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen capture is not supported in this browser.");
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" });
      const track = stream.getVideoTracks()[0];
      const surface = track.getSettings().displaySurface;
      if (surface !== "browser") throw new Error("Select this browser tab, not a window or entire screen.");
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!video.videoWidth || !video.videoHeight) throw new Error("No video frame available.");
      const bounds = heroRef.current?.getBoundingClientRect();
      if (!bounds) throw new Error("Hero not found.");
      const sx = video.videoWidth / window.innerWidth;
      const sy = video.videoHeight / window.innerHeight;
      // A tab capture typically contains the viewport; reject mismatched dimensions
      // rather than exporting an incorrectly cropped or unrelated area.
      if (Math.abs(sx - sy) > 0.15 || sx < 0.5 || sy < 0.5) {
        throw new Error("Tab capture dimensions differ from viewport; accurate cropping cannot be guaranteed.");
      }
      const x = Math.round(bounds.left * sx), y = Math.round(bounds.top * sy);
      const w = Math.round(bounds.width * sx), h = Math.round(bounds.height * sy);
      if (x < 0 || y < 0 || x + w > video.videoWidth || y + h > video.videoHeight) {
        throw new Error("Scroll until the entire HERO card is visible, then try again.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");
      ctx.fillStyle = "#e8ddd2";
      ctx.fillRect(0, 0, 1200, 630);
      const cardWidth = Math.min(354, 630 * w / h);
      ctx.drawImage(video, x, y, w, h, (1200 - cardWidth) / 2, 0, cardWidth, 630);
      setPng(canvas.toDataURL("image/png"));
      setStatus("Tab pixels captured and PNG exported. This does not yet support automatic Kakao sharing.");
    } catch (error) {
      setStatus("Capture failed: " + (error?.message || String(error)));
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  return <main style={{ background: "#e8ddd2", minHeight: "100vh", padding: "10px 18px", color: "#513b33", fontFamily: "Arial,sans-serif" }}>
    <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>DearDay real-pixel HERO capture test</h1>
    <p style={{ margin: "0 0 8px" }}>Select <b>this browser tab</b> when prompted. No image is uploaded or saved to a server.</p>
    <div ref={heroRef} style={{ width: 320, height: 480, background: "#fff8f1", boxSizing: "border-box", border: "3px solid #bda591", marginBottom: 12, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 16, border: "1px solid #c8a78f", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 55, fontSize: 21 }}>The Wedding of</div>
      <div style={{ fontSize: 28 }}>우리의 결혼식</div>
      <div style={{ fontSize: 25, marginTop: 26 }}>정우 ♡ 수지</div>
      <div style={{ fontSize: 18, marginTop: 36 }}>2026. 11. 21</div>
      <div style={{ position: "absolute", bottom: 38, fontSize: 16 }}>DEARDAY</div>
    </div>
    <button onClick={capture} style={{ background: "#513b33", color: "white", border: 0, borderRadius: 6, padding: "12px 18px", cursor: "pointer" }}>Capture this tab's HERO pixels</button>
    <p role="status">{status}</p>
    {png && <div><img src={png} alt="Captured HERO pixels" style={{ maxWidth: "100%", border: "1px solid #bda591" }} /><p><a href={png} download="dearday-real-pixel-probe.png">Download test PNG</a></p></div>}
  </main>;
}
