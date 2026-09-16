export const DEFAULT_AUTH_RETURN_PATH = "/my-invitations";

export function getSafeAuthReturnPath(value, fallback = DEFAULT_AUTH_RETURN_PATH) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  try {
    const base = new URL("https://dearday.local");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
