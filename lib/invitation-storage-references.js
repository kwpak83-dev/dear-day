// Read-only, non-authoritative reference inspection. Never authorize destructive deletion
// based on this result alone: a concurrent writer may add a reference after inspection.
const PAGE_SIZE = 100;
const MAX_PAGES = 1000;
const BUCKETS = new Set(["invitation-photos", "invitation-bgm"]);

export function storageReferenceVariants(supabaseUrl, bucket, path) {
  if (!BUCKETS.has(bucket) || !path || typeof path !== "string") throw new Error("Invalid Storage reference");
  const root = new URL(supabaseUrl);
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return [
    root.origin + "/storage/v1/object/public/" + bucket + "/" + encoded,
    root.origin + "/storage/v1/object/public/" + bucket + "/" + path,
    path,
  ];
}

export function eventReferencesStorage(event, variants) {
  const serialized = JSON.stringify({ cover: event.cover_image_url, settings: event.settings });
  return variants.some((value) => serialized.includes(value));
}

export async function inspectStorageReferences(db, { supabaseUrl, bucket, path, excludeEventId = null }) {
  const variants = storageReferenceVariants(supabaseUrl, bucket, path);
  const referencedBy = [];
  // Search ALL owners. Offset pagination is deliberately bounded and fail-closed.
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await db.from("events").select("id,cover_image_url,settings")
      .order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) throw new Error("Global event reference scan failed");
    for (const event of data) {
      if (event.id !== excludeEventId && eventReferencesStorage(event, variants)) referencedBy.push(event.id);
    }
    if (data.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) throw new Error("Global event reference scan limit exceeded");
  }
  // A media path can be shared independently of settings and cover URLs.
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await db.from("event_media").select("event_id")
      .eq("storage_path", path).order("event_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) throw new Error("Global media reference scan failed");
    for (const row of data) if (row.event_id !== excludeEventId) referencedBy.push(row.event_id);
    if (data.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) throw new Error("Global media reference scan limit exceeded");
  }
  return { referenced: referencedBy.length > 0, referenceCount: referencedBy.length, safeToDelete: false, inspectionOnly: true };
}
