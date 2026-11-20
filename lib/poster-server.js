import { createClient } from "@supabase/supabase-js";
import { readGallery, GALLERY_BUCKET } from "./gallery-server.js";
import { getRetentionState } from "./invitation-retention.js";
import { getEventAccountGroups } from "./event-account-groups.js";
import { isHeroSlotPhotoUrl } from "./hero-slot-photo-url.mjs";
import { checkExport, missingMedia, parsePoster, PosterError } from "./poster-validation.mjs";

function take(result) {
  if (result.error) throw new PosterError(503, "database_unavailable");
  return result.data;
}

async function context(request, slug) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) throw new PosterError(401, "login_required");
  if (!/^[a-z0-9-]{4,80}$/.test(slug || "")) throw new PosterError(400, "invalid_slug");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new PosterError(503, "database_unavailable");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error && (!error.status || error.status >= 500)) throw new PosterError(503, "auth_unavailable");
  if (error || !data?.user) throw new PosterError(401, "login_required");
  const event = take(await supabase.from("events")
    .select("id,slug,owner_id,kind,status,starts_at,service_expires_at,retention_v2,settings,cover_image_url,template_id,template_version_id,hero_preset_id")
    .eq("slug", slug).eq("owner_id", data.user.id).maybeSingle());
  if (!event) throw new PosterError(404, "not_found");
  if (event.kind !== "wedding" || event.status !== "published") throw new PosterError(409, "unavailable");
  if (getRetentionState(event).phase !== "active") throw new PosterError(410, "expired");
  return { supabase, event, url };
}

export function eventPhotoPath(value, url, event) {
  const prefix = new URL("/storage/v1/object/public/invitation-photos/", url).href;
  if (typeof value !== "string" || !isHeroSlotPhotoUrl(value, prefix + event.owner_id + "/", event.id)) return null;
  return value.slice(prefix.length);
}

export async function autoCover({ supabase, event, url }) {
  const settings = event.settings || {};
  const storage = supabase.storage.from(GALLERY_BUCKET);
  async function resolve(value) {
    const path = eventPhotoPath(value, url, event);
    if (!path) return null;
    if (path.split("/").length === 2) {
      // An owner folder alone does not prove that the photo belongs to this event.
      const reservation = take(await supabase.from("invitation_upload_reservations")
        .select("id").eq("bucket", GALLERY_BUCKET).eq("storage_path", path)
        .eq("event_id", event.id).eq("owner_id", event.owner_id).eq("status", "uploaded").maybeSingle());
      if (!reservation) return null;
    }
    const { data, error } = await storage.exists(path);
    if (error && !["404", "400"].includes(String(error.statusCode ?? error.status))) {
      throw new PosterError(503, "storage_unavailable");
    }
    return data ? storage.getPublicUrl(path).data.publicUrl : null;
  }
  for (const candidate of new Set([settings.coverPhotoUrl, settings.coverPhoto, event.cover_image_url])) {
    const cover = await resolve(candidate);
    if (cover) return cover;
  }
  if (!Object.keys(settings.heroSlotPhotos || {}).length) return null;
  const presetId = event.hero_preset_id || settings.heroPresetId;
  const preset = presetId && take(await supabase.from("hero_presets").select("config").eq("id", presetId).maybeSingle());
  let layers = preset?.config?.photoLayers;
  if (!Array.isArray(layers) && (event.template_version_id || event.template_id)) {
    let query = supabase.from("template_versions").select("config");
    query = event.template_version_id ? query.eq("id", event.template_version_id)
      : query.eq("template_id", event.template_id).order("version", { ascending: false }).limit(1);
    layers = take(await query.maybeSingle())?.config?.hero?.photoLayers;
  }
  for (const layer of Array.isArray(layers) ? layers : []) {
    if (!layer?.id || layer.visible === false) continue;
    const cover = await resolve(settings.heroSlotPhotos[layer.id]);
    if (cover) return cover;
  }
  return null;
}

export function posterAccounts(settings, eventTypeConfig, side) {
  if (side === "none") return {};
  const value = key => typeof settings[key] === "string" ? settings[key] : "";
  const groups = getEventAccountGroups("wedding", eventTypeConfig).groups;
  return Object.fromEntries(groups.filter(group => !side || group.key === side).flatMap(group => {
    const key = group.key;
    const role = key === "groom" ? "신랑" : "신부";
    const rows = [
      [role, group.bankKey, group.accountKey, group.holderKey, group.nameKey],
      [role + " 아버지", key + "FatherBank", key + "FatherAccount", key + "FatherAccountHolder", key + "FatherName"],
      [role + " 어머니", key + "MotherBank", key + "MotherAccount", key + "MotherAccountHolder", key + "MotherName"],
    ].flatMap(([label, bankKey, accountKey, holderKey, nameKey]) => {
      const number = value(accountKey).trim();
      return number ? [{ label, number, bank: value(bankKey), holder: value(holderKey) || value(nameKey) || "예금주" }] : [];
    });
    return rows.length ? [[key, { label: group.renderLabel, rows }]] : [];
  }));
}

async function readSource(ctx, side, includeCover = true) {
  const { event } = ctx;
  const s = event.settings || {};
  const str = key => typeof s[key] === "string" ? s[key] : "";
  const origin = process.env.POSTER_PUBLIC_ORIGIN ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  const accountConfig = side === "none" ? null : take(await ctx.supabase.from("event_type_configs")
    .select("fields").eq("kind", "wedding").maybeSingle());
  return {
    names: { groom: str("groom") || str("groomLastName") + str("groomFirstName"), bride: str("bride") || str("brideLastName") + str("brideFirstName") },
    startsAt: event.starts_at, date: str("date"), time: str("time"), venue: str("venue"), venueAddress: str("venueAddress"),
    accounts: posterAccounts(s, accountConfig, side),
    autoCoverUrl: includeCover ? await autoCover(ctx) : null,
    publicPath: `/invite/${encodeURIComponent(event.slug)}`,
    publicUrl: origin ? new URL(`/invite/${encodeURIComponent(event.slug)}`, origin).href : null,
  };
}

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function handle(request, params, action) {
  try {
    const ctx = await context(request, (await params).slug);
    return json(await action(ctx));
  } catch (error) {
    if (error instanceof PosterError) return json({ error: error.code }, error.status);
    return json({ error: "service_unavailable" }, 503);
  }
}

async function input(request) {
  try { return await request.json(); } catch { throw new PosterError(400, "invalid_settings"); }
}

export function getPoster(request, { params }) {
  return handle(request, params, async ctx => {
    const stored = take(await ctx.supabase.from("invitation_posters").select("*").eq("event_id", ctx.event.id).maybeSingle());
    const { photos: gallery } = await readGallery(ctx);
    const normalized = parsePoster({ designKey: stored?.design_key ?? "playful-pop", settings: stored?.settings ?? {} });
    return { source: await readSource(ctx), poster: { ...normalized, revision: stored?.revision ?? 0, updatedAt: stored?.updated_at ?? null },
      gallery, missingMediaIds: missingMedia(normalized.settings, gallery) };
  });
}

export function putPoster(request, { params }) {
  return handle(request, params, async ctx => {
    const body = await input(request);
    const poster = parsePoster(body);
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647) {
      throw new PosterError(400, "invalid_revision");
    }
    const data = take(await ctx.supabase.rpc("save_invitation_poster", {
      p_event: ctx.event.id, p_owner: ctx.event.owner_id, p_design: poster.designKey,
      p_settings: poster.settings, p_revision: body.expectedRevision,
    }));
    if (data.error) {
      const status = { not_found: 404, unavailable: 409, expired: 410, invalid: 400,
        invalid_design: 400, invalid_settings: 400, invalid_media_id: 400, invalid_revision: 400,
        media_unavailable: 422, revision_conflict: 409 };
      throw new PosterError(status[data.error] || 503, status[data.error] ? data.error : "database_unavailable");
    }
    return { poster: { ...poster, revision: data.poster.revision, updatedAt: data.poster.updated_at } };
  });
}

export function exportPosterPreflight(request, { params }) {
  return handle(request, params, async ctx => {
    const body = await input(request);
    const poster = parsePoster(body);
    const coverNeeded = ["all", "page1"].includes(body.scope);
    const galleryNeeded = ["all", "page2"].includes(body.scope) || (coverNeeded && poster.settings.cover.source === "gallery");
    const { photos } = galleryNeeded ? await readGallery(ctx) : { photos: [] };
    const source = await readSource(ctx, coverNeeded ? poster.settings.accountSide : "none",
      coverNeeded && poster.settings.cover.source === "auto");
    checkExport(body.scope, poster.settings, source, photos);
    if (["all", "page3"].includes(body.scope) && !source.publicUrl) throw new PosterError(503, "public_origin_unavailable");
    const selected = new Set([
      ...(["all", "page2"].includes(body.scope) ? poster.settings.gallery.photos.map(p => p.mediaId) : []),
      ...(coverNeeded ? [poster.settings.cover.mediaId] : []),
    ]);
    return { scope: body.scope, source, poster, gallery: photos.filter(photo => selected.has(photo.id)) };
  });
}
