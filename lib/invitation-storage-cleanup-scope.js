// A matching path and completed reservation are evidence of provenance only.
// Neither establishes that all live references have been inventoried.
export function hasInvitationScopedUpload(job, reservation) {
  if (reservation?.status !== "uploaded" ||
      reservation.event_id !== job.event_id || reservation.owner_id !== job.owner_id) return false;
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
  if (!uuid.test(job.owner_id) || !uuid.test(job.event_id) || typeof job.storage_path !== "string") return false;
  const [owner, kind, event, filename, extra] = job.storage_path.split("/");
  if (owner !== job.owner_id || event !== job.event_id || extra !== undefined || typeof filename !== "string") return false;
  const [name, extension, suffix] = filename.split(".");
  if (suffix !== undefined || !uuid.test(name)) return false;
  if (job.bucket === "invitation-bgm") return kind === "bgm" && extension === "mp3";
  if (job.bucket !== "invitation-photos") return false;
  return (["notice", "gallery", "photo"].includes(kind) && extension === "jpg") ||
    (kind === "photo" && extension === "webp");
}
