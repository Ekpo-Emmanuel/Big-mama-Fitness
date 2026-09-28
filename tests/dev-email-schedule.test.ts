import { test } from "vitest";
import assert from "node:assert/strict";
import { initialEvent } from "../lib/event";
import {
  compressedProbeTimeline,
  followupOnlyProbeTimeline,
  productionReminderInstants,
} from "../lib/email/dev-compressed-schedule";
import { reminderDueTimes, followupDueAt } from "../lib/email/schedule";

test("production reminder instants match Vancouver event wall times", () => {
  const times = productionReminderInstants(
    initialEvent.startsAt,
    initialEvent.endsAt,
  );
  assert.equal(times.reminder_24, Date.parse("2026-10-16T17:00:00-07:00"));
  assert.equal(times.reminder_3, Date.parse("2026-10-17T14:00:00-07:00"));
  assert.equal(times.followup, Date.parse("2026-10-17T20:30:00-07:00"));
  assert.deepEqual(reminderDueTimes(initialEvent.startsAt), {
    reminder_24: times.reminder_24,
    reminder_3: times.reminder_3,
  });
  assert.equal(followupDueAt(initialEvent.endsAt), times.followup);
});

test("compressed probe timeline does not mutate production schedule helpers", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const probe = compressedProbeTimeline(now);
  assert.equal(probe.reminder_24_at, now + 2 * 60_000);
  assert.equal(probe.reminder_3_at, now + 4 * 60_000);
  assert.equal(probe.startsAtMs, now + 6 * 60_000);
  assert.equal(probe.endsAtMs, now + 8 * 60_000);
  assert.equal(probe.followup_at, now + 10 * 60_000);
  const prod = reminderDueTimes(initialEvent.startsAt);
  assert.equal(prod.reminder_24, Date.parse("2026-10-16T17:00:00-07:00"));
});

test("follow-up-only probe schedules sole follow-up after delay; prod helpers untouched", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  const probe = followupOnlyProbeTimeline(2, now);
  assert.equal(probe.followup_at, now + 2 * 60_000);
  assert.equal(probe.endsAtMs, now - 2 * 60_000);
  assert.equal(probe.startsAtMs, now - 12 * 60_000);
  assert.equal(probe.delayMinutes, 2);
  assert.equal(
    followupDueAt(initialEvent.endsAt),
    Date.parse("2026-10-17T20:30:00-07:00"),
  );
});
