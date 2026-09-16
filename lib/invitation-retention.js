export const PUBLIC_DAYS_AFTER_EVENT = 14;
export const GRACE_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function timestamp(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

export function calculateRetentionDates(startsAt, previousExpiresAt) {
  const eventTime = timestamp(startsAt);
  if (eventTime === null) return null;
  const priorTime = timestamp(previousExpiresAt);
  const expiresAt = Math.max(eventTime + PUBLIC_DAYS_AFTER_EVENT * DAY_MS, priorTime ?? -Infinity);
  return {
    service_expires_at: new Date(expiresAt).toISOString(),
    grace_ends_at: new Date(expiresAt + GRACE_PERIOD_DAYS * DAY_MS).toISOString(),
  };
}

export function getRetentionState(event, now = Date.now()) {
  if (event?.status !== "published" && event?.status !== "suspended") return { phase: "not-applicable" };
  const expiresAt = timestamp(event.service_expires_at)
    ?? (timestamp(event.starts_at) === null ? null : timestamp(event.starts_at) + PUBLIC_DAYS_AFTER_EVENT * DAY_MS);
  if (expiresAt === null) return { phase: "unknown", expiresAt: null, graceEndsAt: null, deletionEligibleAt: null };
  const graceEndsAt = timestamp(event.grace_ends_at) ?? expiresAt + GRACE_PERIOD_DAYS * DAY_MS;
  return {
    phase: now < expiresAt ? "active" : now < graceEndsAt ? "grace-period" : "expired",
    expiresAt: new Date(expiresAt).toISOString(),
    graceEndsAt: new Date(graceEndsAt).toISOString(),
    deletionEligibleAt: new Date(graceEndsAt).toISOString(),
  };
}

export function isPublicPeriodExpired(event, now) {
  const phase = getRetentionState(event, now).phase;
  return phase === "grace-period" || phase === "expired";
}