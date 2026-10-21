import { ImageResponse } from "next/og";

// Preview-only composition probe: a 9:16 card inside a Kakao-style 1200x630 canvas.
// No event data, external URLs, database writes, or changes to live sharing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const title = (url.searchParams.get("title") || "우리의 결혼식").slice(0, 40);
  const names = (url.searchParams.get("names") || "정우 ♡ 수지").slice(0, 40);
  const heartParts = names.split("♡");
  try {
    const result = new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", background: "#e8ddd2" }}>
        <div style={{ display: "flex", width: 348, height: 618, position: "relative", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#fff8f1", overflow: "hidden", border: "2px solid #bda591" }}>
          <div style={{ display: "flex", position: "absolute", top: 20, left: 20, right: 20, bottom: 20, border: "1px solid #c8a78f" }} />
          <div style={{ display: "flex", position: "absolute", top: 65, fontSize: 23, color: "#82634d" }}>The Wedding of</div>
          <div style={{ display: "flex", position: "absolute", top: 220, fontSize: 34, color: "#513b33" }}>{title}</div>
          <div style={{ display: "flex", position: "absolute", top: 300, fontSize: 31, color: "#513b33", alignItems: "center", gap: 8 }}>{heartParts.map((part, index) => <div key={index} style={{ display: "flex", alignItems: "center" }}>{index > 0 && <svg width="27" height="27" viewBox="0 0 24 24" style={{ marginRight: 8 }}><path d="M12 21s-8.5-5.4-10-10.5C.5 5.5 5.2 2.8 9 5.5L12 8l3-2.5c3.8-2.7 8.5 0 7 5C20.5 15.6 12 21 12 21Z" fill="none" stroke="#513b33" strokeWidth="1.5" strokeLinejoin="round" /></svg>}{part}</div>)}</div>
          <div style={{ display: "flex", position: "absolute", top: 405, fontSize: 18, color: "#82634d" }}>2026. 11. 21</div>
          <div style={{ display: "flex", position: "absolute", bottom: 52, fontSize: 18, color: "#82634d" }}>DEARDAY</div>
        </div>
      </div>,
      { width: 1200, height: 630 }
    );
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch (error) {
    console.error("Layer image probe failed:", error);
    return new Response("Layer rendering failed", { status: 500 });
  }
}
