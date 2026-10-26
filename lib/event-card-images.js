import { BRAND_THUMBNAIL_PATH } from "./brand-share-image";

// Display only: no per-event lookups, capture, uploads, or stored data changes.
export async function addEventCardImages(client, events, projectUrl) {
  return events.map(event => ({ ...event,
    cardImageUrl: BRAND_THUMBNAIL_PATH,
    cardImageSource: "dearday-brand",
  }));
}
