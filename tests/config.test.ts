import { test } from "vitest";
import assert from "node:assert/strict";
import { eventConfigSchema } from "../lib/event-config";
import { initialEvent } from "../lib/event";
import { fixture } from "./harness";
import { findEvent } from "../convex/events";
import { fromDanceEvent, toDanceEvent } from "../convex/map";
test("event configuration validates schedule, hard capacity, waiver versions, and local media", async () => {
  assert.equal(eventConfigSchema.safeParse(initialEvent).success, true);
  assert.equal(
    eventConfigSchema.safeParse({ ...initialEvent, capacity: 21 }).success,
    false,
  );
  assert.equal(
    eventConfigSchema.safeParse({
      ...initialEvent,
      waiverText: "text only",
      waiverVersion: "",
    }).success,
    false,
  );
  assert.equal(
    eventConfigSchema.safeParse({
      ...initialEvent,
      heroImageUrl: "https://untrusted.example/picture.jpg",
    }).success,
    false,
  );
  assert.equal(
    eventConfigSchema.safeParse({
      ...initialEvent,
      endsAt: initialEvent.startsAt,
    }).success,
    false,
  );
  const t = await fixture();
  await t.mutation(async (ctx) => {
    const event = eventConfigSchema.parse({
      ...initialEvent,
      startsAt: "2099-10-17T17:00:00-07:00",
      endsAt: "2099-10-17T18:30:00-07:00",
      workoutStartsAt: "2099-10-17T17:15:00-07:00",
      workoutEndsAt: "2099-10-17T18:15:00-07:00",
      waiverText: "Test waiver",
      waiverVersion: "test-v1",
      headline: "Updated headline",
    });
    const existing = await findEvent(ctx, event.id);
    await ctx.db.patch(
      existing!._id,
      fromDanceEvent(event, {
        soldCount: existing!.soldCount,
        heldCount: existing!.heldCount,
      }),
    );
  });
  const headline = await t.query(async (ctx) => {
    const row = await findEvent(ctx, initialEvent.id);
    return toDanceEvent(row!).headline;
  });
  assert.equal(headline, "Updated headline");
});
