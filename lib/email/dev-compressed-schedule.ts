/** DEV-only compressed offsets for schedule probes. Production schedule.ts stays unchanged. */
const MINUTE = 60_000;

export function compressedProbeTimeline(now = Date.now()) {
  return {
    now,
    reminder_24_at: now + 2 * MINUTE,
    reminder_3_at: now + 4 * MINUTE,
    startsAtMs: now + 6 * MINUTE,
    endsAtMs: now + 8 * MINUTE,
    followup_at: now + 10 * MINUTE,
  };
}

/**
 * DEV-only: event already ended; schedule follow-up alone after `delayMinutes`.
 * Does not touch production schedule constants.
 */
export function followupOnlyProbeTimeline(
  delayMinutes = 2,
  now = Date.now(),
) {
  const delayMs = Math.max(1, delayMinutes) * MINUTE;
  return {
    now,
    startsAtMs: now - 12 * MINUTE,
    endsAtMs: now - 2 * MINUTE,
    followup_at: now + delayMs,
    delayMinutes: Math.max(1, delayMinutes),
  };
}

export function productionReminderInstants(startsAt: string, endsAt: string) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const HOUR = 60 * 60 * 1000;
  return {
    reminder_24: start - 24 * HOUR,
    reminder_3: start - 3 * HOUR,
    followup: end + 2 * HOUR,
    startsAt: start,
    endsAt: end,
  };
}
