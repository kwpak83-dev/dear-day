// Conservative diagnostic categories only. Never return raw database errors,
// object paths, URLs, or owner identifiers to the audit response.
export function cleanupFailureCategory(message) {
  if (typeof message !== "string" || !message.trim()) return "unknown";
  const value = message.toLowerCase();
  if (/shared|conflict|duplicate|unique constraint/.test(value)) return "path_conflict";
  if (/reserv|upload|in.flight|in flight/.test(value)) return "upload_incomplete";
  if (/referenc|still used|in use/.test(value)) return "reference_exists";
  if (/timeout|connection|network|query|database|scan|fetch/.test(value)) return "inspection_error";
  return "unknown";
}
