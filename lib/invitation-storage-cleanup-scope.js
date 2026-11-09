// A matching path and completed reservation are evidence of provenance only.
// Neither establishes that all live references have been inventoried.
export function hasInvitationScopedUpload(job, reservation) {
  if (job.bucket !== "invitation-photos" || reservation?.status !== "uploaded" ||
      reservation.event_id !== job.event_id || reservation.owner_id !== job.owner_id) return false;
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
  if (!uuid.test(job.owner_id) || !uuid.test(job.event_id) || typeof job.storage_path !== "string") return false;
  const [owner, kind, event, filename, extra] = job.storage_path.split("/");
  return owner === job.owner_id && kind === "notice" && event === job.event_id &&
    extra === undefined && typeof filename === "string" &&
    filename.endsWith(".jpg") && uuid.test(filename.slice(0, -4));
}
