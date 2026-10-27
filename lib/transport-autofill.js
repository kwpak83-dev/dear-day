export const TRANSPORT_AUTO_FIELDS = ["transportPublic", "transportCar"];

export function getAutomaticTransport(invitation) {
  const values = invitation.transportAutoSource?.values || {};
  return Object.fromEntries(TRANSPORT_AUTO_FIELDS.filter(key => typeof values[key] === "string" && values[key] === invitation[key]).map(key => [key, values[key]]));
}

export function clearAutomaticTransport(invitation, automatic = {}) {
  const patch = {};
  for (const key of TRANSPORT_AUTO_FIELDS) if (typeof automatic[key] === "string" && invitation[key] === automatic[key]) patch[key] = "";
  if (!Object.keys(patch).length && !invitation.transportAutoSource) return invitation;
  const { transportAutoSource, ...rest } = invitation;
  return { ...rest, ...patch };
}

// A manual edit, including editing and then erasing, invalidates the request's
// field revision. Existing manual content is protected within the same place.
export function transportSuggestionPatch(current, baseline, revisions, expectedRevisions, suggestions) {
  return Object.fromEntries(TRANSPORT_AUTO_FIELDS.filter(key =>
    !baseline[key] && !current[key] && revisions[key] === expectedRevisions[key] && typeof suggestions[key] === "string"
  ).map(key => [key, suggestions[key].slice(0, 2000)]));
}

export function carDirections(venue, address) {
  const clean = value => String(value || "").replace(/[<>\r\n]/g, " ").trim().slice(0, 200);
  const name = clean(venue), location = clean(address);
  return name && location ? `내비게이션에 ‘${name}’ 또는 아래 주소를 검색해 주세요.\n주소: ${location}` : "";
}

// Optional provenance inside existing settings JSON: distinguish generated text
// from manual text even after save/reopen. No separate draft or DB column.
export function applyAutomaticTransport(invitation, patch, place) {
  const values = Object.fromEntries(Object.entries(patch).filter(([key, value]) => TRANSPORT_AUTO_FIELDS.includes(key) && value));
  if (!Object.keys(values).length) return invitation;
  const previous = invitation.transportAutoSource;
  const same = previous?.venue === place.venue && previous?.address === place.address && previous?.eventKind === place.eventKind;
  return { ...invitation, ...patch, transportAutoSource: { ...place, values: { ...(same ? getAutomaticTransport(invitation) : {}), ...values } } };
}
export function editTransportField(invitation, key, value) {
  if (!invitation.transportAutoSource) return { ...invitation, [key]: value };
  const { [key]: removed, ...values } = getAutomaticTransport(invitation);
  const next = { ...invitation, [key]: value };
  next.transportAutoSource = { ...invitation.transportAutoSource, values };
  return next;
}

// Explicit selection of a different venue invalidates both venue-specific texts,
// including previously edited text. Parking and all enabled flags stay intact.
export function prepareTransportPlaceSelection(invitation, place, previousPlace, automatic = {}, allowed = true) {
  const normalize = value => String(value || "").trim().replace(/\s+/g, " ");
  const previous = previousPlace || invitation.transportAutoSource;
  const address = normalize(previous?.address || invitation.venueAddress);
  const venue = normalize(previous?.venue || invitation.venue);
  const changed = (address && address !== normalize(place.address)) ||
    (previous && venue && venue !== normalize(place.venue)) ||
    (!address && venue && venue !== normalize(place.venue));
  const cleared = clearAutomaticTransport(invitation, automatic);
  if (!allowed) return cleared;
  return { ...cleared, ...(changed ? { transportPublic: "", transportCar: "" } : {}),
    transportAutoSource: { ...place, values: {} } };
}

// Merge independently completed bus/subway sections only while this request still
// owns the field. A manual edit (even edit-then-erase) changes the revision.
export function mergeTransportPublic(invitation, baseline, revisions, expectedRevisions, sections, place) {
  if (baseline.transportPublic || revisions.transportPublic !== expectedRevisions.transportPublic) return invitation;
  const owned = getAutomaticTransport(invitation).transportPublic;
  if (invitation.transportPublic && invitation.transportPublic !== owned) return invitation;
  const text = [sections.subway, sections.bus].filter(Boolean).join("\n\n").slice(0, 2000);
  return text ? applyAutomaticTransport(invitation, { transportPublic: text }, place) : invitation;
}
