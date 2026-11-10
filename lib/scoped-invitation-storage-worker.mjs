export async function processScopedStorageJob(db, id) {
  const { data, error } = await db.rpc("claim_scoped_invitation_storage_cleanup", { p_job_id: id });
  if (error) throw error;
  const claim = data?.[0];
  if (!claim) return "skipped";
  let succeeded = false;
  try {
    const result = await db.storage.from(claim.bucket).remove([claim.storage_path]);
    succeeded = !result.error;
  } catch {
    // A transport error does not tell us whether Storage removed the object.
  }
  const settled = await db.rpc("settle_scoped_invitation_storage_cleanup", {
    p_job_id: id, p_attempt: claim.attempt, p_succeeded: succeeded,
  });
  if (settled.error) throw settled.error;
  if (settled.data !== true) return "unconfirmed";
  return succeeded ? "removed" : "failed";
}

export async function runScopedStorageCleanup(db, eventId = null) {
  // An optional UUID limits a run to one deleted invitation.
  const query = db.from("invitation_storage_cleanup_jobs")
    .select("id")
    .or("and(bucket.eq.invitation-photos,or(storage_path.like.*/notice/*,storage_path.like.*/photo/*,storage_path.like.*/gallery/*)),and(bucket.eq.invitation-bgm,storage_path.like.*/bgm/*)")
    .in("status", ["pending", "retry"]).lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").order("id").limit(10);
  const { data, error } = await (eventId ? query.eq("event_id", eventId) : query);
  if (error) throw error;
  const report = { mode: "execute", removed: 0, failed: 0, skipped: 0, unconfirmed: 0 };
  for (const job of data || []) {
    if (!Number.isSafeInteger(job.id)) { report.skipped++; continue; }
    try { report[await processScopedStorageJob(db, job.id)]++; }
    catch { report.unconfirmed++; }
  }
  return report;
}
