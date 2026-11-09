import { test } from "vitest";
import assert from "node:assert/strict";
import { initialEvent, octoberEvent, eventState } from "../lib/event";
import { harness } from "./harness";
import { seedIfNeeded } from "../convex/events";
test("event seed and inventory are durable and repeatable", async () => {
  const t = harness();
  await t.mutation((ctx) => seedIfNeeded(ctx));
  const data = await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", initialEvent.slug))
      .collect();
    const row = rows[0];
    return { price: row!.priceCents, sold: row!.soldCount, held: row!.heldCount };
  });
  assert.equal(data.price, 1000);
  assert.deepEqual({ sold: data.sold, held: data.held }, { sold: 0, held: 0 });
  const october = await t.query(async (ctx) => {
    const row = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", octoberEvent.id))
      .unique();
    return row ? { slug: row.slug, status: row.status, capacity: row.capacity } : null;
  });
  assert.equal(october?.slug, "afro-dance-fitness-oct-17");
  assert.equal(october?.status, "completed");
  assert.equal(october?.capacity, 20);
});

test("seed repairs duplicate marketing slugs so unique lookup is not required", async () => {
  const t = harness();
  await t.mutation(async (ctx) => {
    await seedIfNeeded(ctx);
    const oct = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", octoberEvent.id))
      .collect();
    await ctx.db.patch(oct[0]!._id, { slug: initialEvent.slug });
  });
  await t.mutation((ctx) => seedIfNeeded(ctx));
  const slugs = await t.query(async (ctx) => {
    const rows = await ctx.db.query("events").collect();
    return rows
      .filter((row) => row.slug === initialEvent.slug)
      .map((row) => row.eventId);
  });
  assert.deepEqual(slugs, [initialEvent.id]);
});
test("public states prioritize cancellation and completion over inventory", () => {
  const now = Date.parse("2026-10-01");
  assert.equal(eventState(initialEvent, 0, now), "open");
  assert.equal(eventState(initialEvent, 15, now), "sold_out");
  assert.equal(
    eventState({ ...initialEvent, status: "cancelled" }, 20, now),
    "cancelled",
  );
  assert.equal(
    eventState(initialEvent, 15, Date.parse("2026-11-22T03:00:00.000Z")),
    "completed",
  );
});
