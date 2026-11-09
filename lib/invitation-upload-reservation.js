// Event-scoped Storage upload ledger. This module never removes Storage objects.
// Only enabled after SQL migration 012-013 has been tested and applied.
export async function reserveUploadIfEnabled(db, userId, request, bucket, path) {
  if (process.env.INVITATION_UPLOAD_RESERVATIONS_READY !== "true") return { enabled: false, id: null };
  const slug = request.headers.get("x-event-slug") || "";
  if (!/^[a-z0-9-]{4,80}$/.test(slug)) {
    return { error: "초대장을 먼저 임시저장한 뒤 다시 업로드해 주세요.", status: 400 };
  }
  const { data: event, error: lookupError } = await db.from("events")
    .select("id").eq("slug", slug).eq("owner_id", userId).maybeSingle();
  if (lookupError) return { error: "초대장 정보를 확인하지 못했어요.", status: 503 };
  if (!event) return { error: "초대장을 찾을 수 없어요.", status: 409 };
  const { data: id, error } = await db.rpc("reserve_invitation_upload", {
    p_event: event.id, p_owner: userId, p_bucket: bucket, p_path: path,
  });
  if (error || !id) return { error: "초대장 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.", status: 409 };
  return { enabled: true, id };
}

export async function finishReservedUpload(db, userId, reservation, uploaded) {
  if (!reservation?.id) return true;
  const { data, error } = await db.rpc("finish_invitation_upload", {
    p_reservation: reservation.id, p_owner: userId, p_uploaded: uploaded,
  });
  return !error && data === true;
}
