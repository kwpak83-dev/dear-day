import { ImageResponse } from "next/og";

// Isolated DEV-only rendering probe. Does not read invitation data or alter sharing.
// This validates Vercel's image response pipeline, NOT Chromium screenshots.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "DearDay").slice(0, 40);
  try {
    const image = new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6eee6", padding: 60 }}>
        <div style={{ display: "flex", width: "100%", height: "100%", border: "4px solid #a98e7a", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#513b33" }}>
          <div style={{ fontSize: 46, marginBottom: 28 }}>Wedding Invitation</div>
          <div style={{ fontSize: 62, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 24, marginTop: 28 }}>DearDay rendering probe</div>
        </div>
      </div>,
      { width: 1200, height: 630 }
    );
    image.headers.set("Cache-Control", "no-store");
    return image;
  } catch (error) {
    console.error("Share image probe failed:", error);
    return new Response("Image rendering failed", { status: 500 });
  }
}
