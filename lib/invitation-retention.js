// Event service ends and is eligible for deletion at 00:00 KST, 30 calendar days after its event date.
export const PUBLIC_DAYS_AFTER_EVENT = 30;
export const GRACE_PERIOD_DAYS = 0;
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_MS = 9 * 60 * 60 * 1000;

function timestamp(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

export function eventDeletionTime(startsAt) {
  const start = timestamp(startsAt);
  if (start === null) return null;
  const date = new Date(start + KST_MS).toISOString().slice(0, 10);
  return Date.parse(`${date}T00:00:00+09:00`) + PUBLIC_DAYS_AFTER_EVENT * DAY_MS;
}

export function calculateRetentionDates(startsAt) {
  const expiresAt = eventDeletionTime(startsAt);
  if (expiresAt === null) return null;
  return { service_expires_at: new Date(expiresAt).toISOString(), grace_ends_at: new Date(expiresAt).toISOString() };
}

export function getRetentionState(event, now = Date.now()) {
  if (!event || !["published", "suspended"].includes(event.status)) return { phase: "not-applicable" };
  if (event.retention_v2 === false) {
    const legacyExpiry = timestamp(event.service_expires_at);
    return {
      phase: legacyExpiry === null ? "unknown" : now < legacyExpiry ? "active" : "expired",
      expiresAt: legacyExpiry === null ? null : new Date(legacyExpiry).toISOString(),
      graceEndsAt: event.grace_ends_at ?? null,
      deletionEligibleAt: null,
    };
  }
  const expiresAt = eventDeletionTime(event.starts_at);
  if (expiresAt === null) return { phase: event.retention_v2 === true ? "expired" : "unknown", expiresAt: null, graceEndsAt: null, deletionEligibleAt: null };
  const iso = new Date(expiresAt).toISOString();
  return { phase: now < expiresAt ? "active" : "expired", expiresAt: iso, graceEndsAt: iso, deletionEligibleAt: iso };
}

export function isPublicPeriodExpired(event, now) {
  return getRetentionState(event, now).phase === "expired";
}

// Published invitations become read-only when the event begins, not at the next midnight.
export function isEventReadOnly(event, now = Date.now()) {
  if (!event || !["published", "suspended"].includes(event.status)) return false;
  const start = timestamp(event.starts_at);
  if (start === null) return event.retention_v2 === true;
  if (event.retention_v2 === false) {
    const date = new Date(start + KST_MS).toISOString().slice(0, 10);
    return now >= Date.parse(`${date}T00:00:00+09:00`) + DAY_MS;
  }
  return now >= start;
}
