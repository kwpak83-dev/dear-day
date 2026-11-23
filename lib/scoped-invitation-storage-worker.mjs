export async function processScopedStorageJob(db, id) {
  const { data, error } = await db.rpc("claim_scoped_invitation_storage_cleanup", { p_job_id: id });
  if (error) throw error;
  const claim = data?.[0];
  if (!claim) return "skipped";
  let succeeded = false;
  try {
    const bucket = db.storage.from(claim.bucket);
    succeeded = claim.bucket === "invitation-photos"
      ? await removeAndVerify(bucket, claim.storage_path)
      : !(await bucket.remove([claim.storage_path])).error;
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

async function verifyExpiredInvitationPhotos(db, eventId) {
  const audit = await db.from("invitation_deletion_audit")
    .select("owner_id,photo_cleanup_holds")
    .eq("event_id", eventId).eq("outcome", "completed").eq("storage_cleanup_eligible", true)
    .not("photo_cleanup_holds", "is", null)
    .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  if (audit.error) throw audit.error;
  if (!audit.data) return { status: "unverified" };

  const jobs = db.from("invitation_storage_cleanup_jobs");
  const count = () => jobs.select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("owner_id", audit.data.owner_id).eq("bucket", "invitation-photos");
  const bucket = db.storage.from("invitation-photos");
  const [pending, failed, blocked, ...folders] = await Promise.all([
    count().in("status", ["pending", "retry"]),
    count().eq("status", "failed"),
    count().in("status", ["pending", "retry"]).eq("last_error", "Storage reference or ownership requires review"),
    ...["photo", "gallery", "notice"].map(folder =>
      bucket.list(`${audit.data.owner_id}/${folder}/${eventId}`, { limit: 1 })),
  ]);
  const holds = audit.data.photo_cleanup_holds;
  const held = holds.length;
  let remaining = folders.some(folder => folder.data?.length) ? true
    : folders.every(folder => !folder.error && Array.isArray(folder.data)) ? false : null;
  if (remaining !== true && held) {
    // Flat legacy objects cannot be seen by listing the three event folders.
    const paths = holds.slice(0, 10).map(hold => hold.path);
    const checked = await Promise.all(paths.map(async path => {
      if (!path?.startsWith(audit.data.owner_id + "/") ||
          !path.split("/").every(part => /^[\w.-]+$/.test(part) && part !== "." && part !== "..")) return null;
      try {
        const { data, error } = await bucket.info(path);
        return data && !error ? true : objectMissing(error) ? false : null;
      } catch { return null; }
    }));
    if (checked.includes(true)) remaining = true;
    else if (remaining === false && (checked.length < held || checked.includes(null))) remaining = null;
  }
  let status = "verified_zero";
  if ([pending, failed, blocked].some(result => result.error || !Number.isInteger(result.count))) status = "unconfirmed";
  else if (held || blocked.count) status = "held";
  else if (failed.count) status = "failed";
  else if (pending.count) status = "pending";
  else if (remaining === null) status = "unconfirmed";
  else if (remaining) status = "remaining";
  return { status, remaining, held, blocked: blocked.count, failed: failed.count, pending: pending.count };
}

export async function reportExpiredInvitationPhotos(db, eventIds) {
  if (!eventIds.length) return {};
  const photoCleanup = await Promise.all(eventIds.map(async eventId => {
    try { return { eventId, ...await verifyExpiredInvitationPhotos(db, eventId) }; }
    catch { return { eventId, status: "unconfirmed" }; }
  }));
  return {
    photoCleanup,
    photoVerifiedZero: photoCleanup.filter(event => event.status === "verified_zero").length,
    photoNeedsReview: photoCleanup.filter(event =>
      ["held", "failed", "remaining", "unconfirmed", "unverified"].includes(event.status)).length,
  };
}

export async function runScopedStorageCleanup(db, eventId = null) {
  // An optional UUID limits a run to one deleted invitation.
  // A scoped test already has an exact event ID. Do not apply the broad
  // PostgREST path filter here: the claim RPC independently enforces the
  // event-scoped path, ownership evidence and reference fences.
  const baseQuery = db.from("invitation_storage_cleanup_jobs")
    .select("id,event_id")
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
  const touched = eventId ? [eventId] : [...new Set((data || []).map(job => job.event_id).filter(Boolean))];
  return { ...report, ...await reportExpiredInvitationPhotos(db, touched) };
}
function objectMissing(error) {
  const status = Number(error?.status);
  return (status === 404 || (status === 400 && String(error?.statusCode) === "404")) &&
    (error.code === "NoSuchKey" || error.statusCode === "NoSuchKey" ||
      /^Object not found\.?$/i.test(error.message));
}

async function removeAndVerify(bucket, path) {
  const before = await bucket.info(path);
  if (before.error) return objectMissing(before.error);
  if (!before.data) return false;
  const removed = await bucket.remove([path]);
  if (removed.error) return false;
  return objectMissing((await bucket.info(path)).error);
}
