import { test } from "vitest";
import assert from "node:assert/strict";
import { initialEvent, eventState } from "../lib/event";
import { harness } from "./harness";
import { seedIfNeeded } from "../convex/events";
test("event seed and inventory are durable and repeatable", async () => {
  const t = harness();
  await t.mutation((ctx) => seedIfNeeded(ctx));
  const data = await t.query(async (ctx) => {
    const row = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", initialEvent.slug))
      .unique();
    return {
      price: row!.priceCents,
      sold: row!.soldCount,
      held: row!.heldCount,
    };
  });
  assert.equal(data.price, 1000);
  assert.deepEqual({ sold: data.sold, held: data.held }, { sold: 0, held: 0 });
});
test("public states prioritize cancellation and completion over inventory", () => {
  const now = Date.parse("2026-10-01");
  assert.equal(eventState(initialEvent, 0, now), "open");
  assert.equal(eventState(initialEvent, 20, now), "sold_out");
  assert.equal(
    eventState({ ...initialEvent, status: "cancelled" }, 20, now),
    "cancelled",
  );
  assert.equal(
    eventState(initialEvent, 20, Date.parse("2026-11-01")),
    "completed",
  );
  assert.equal(
    eventState({ ...initialEvent, capacity: 15 }, 15, now),
    "sold_out",
  );
  assert.equal(eventState({ ...initialEvent, capacity: 15 }, 14, now), "open");
});
