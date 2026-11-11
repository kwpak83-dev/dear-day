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
  // A scoped test already has an exact event ID. Do not apply the broad
  // PostgREST path filter here: the claim RPC independently enforces the
  // event-scoped path, uploaded reservation, ownership and reference fences.
  const baseQuery = db.from("invitation_storage_cleanup_jobs")
    .select("id")
    .in("status", ["pending", "retry"])
    .lte("next_attempt_at", new Date().toISOString());
  const query = eventId
    ? baseQuery.eq("event_id", eventId)
    : baseQuery.or("and(bucket.eq.invitation-photos,or(storage_path.like.*/notice/*,storage_path.like.*/photo/*,storage_path.like.*/gallery/*)),and(bucket.eq.invitation-bgm,storage_path.like.*/bgm/*)");
  const { data, error } = await query.order("next_attempt_at").order("id").limit(10);
  if (error) throw error;
  const report = { mode: "execute", removed: 0, failed: 0, skipped: 0, unconfirmed: 0 };
  if (eventId) {
    // Diagnostic counts only; never expose object paths or credentials.
    const { data: scopedRows, error: scopedError } = await db
      .from("invitation_storage_cleanup_jobs")
      .select("id,status,next_attempt_at")
      .eq("event_id", eventId).limit(20);
    // Compare exact job visibility against event-filtered visibility. This is
    // read-only and limited to the explicitly authorized scoped test path.
    const { data: exactJob, error: exactError } = await db
      .from("invitation_storage_cleanup_jobs")
      .select("id,event_id,status,next_attempt_at")
      .eq("id", 22).maybeSingle();
    const { count: visibleCount, error: countError } = await db
      .from("invitation_storage_cleanup_jobs")
      .select("id", { count: "exact", head: true });
    report.diagnostics = {
      exactJob22Visible: !exactError && Boolean(exactJob),
      exactJob22MatchesScope: !exactError && Boolean(exactJob) && exactJob.event_id === eventId,
      exactJob22Status: exactError ? null : exactJob?.status ?? null,
      visibleJobCount: countError ? null : visibleCount,
      exactLookupError: exactError?.code || null,
      countLookupError: countError?.code || null,
      selected: (data || []).length,
      scopedRows: scopedError ? null : (scopedRows || []).map(row => ({
        id: row.id,
        status: row.status,
        due: row.next_attempt_at ? Date.parse(row.next_attempt_at) <= Date.now() : null,
      })),
      serverTime: new Date().toISOString(),
      lookupError: Boolean(scopedError),
    };
  }
  for (const job of data || []) {
    if (!(typeof job.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.id)) && !Number.isSafeInteger(job.id)) { report.skipped++; continue; }
    try { report[await processScopedStorageJob(db, job.id)]++; }
    catch { report.unconfirmed++; }
  }
  return report;
}
