export const TERMS_VERSION = "2026-10-23-alpha";
export const PRIVACY_VERSION = "2026-10-23-alpha";

export function getConsentReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/my-invitations";
  try {
    const url = new URL(value, "https://dearday.local");
    return url.origin === "https://dearday.local" && !url.pathname.startsWith("/signup/consent")
      ? url.pathname + url.search + url.hash : "/my-invitations";
  } catch { return "/my-invitations"; }
}
