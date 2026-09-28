import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { seedIfNeeded } from "../convex/events";
import { initialEvent } from "../lib/event";

const modules = import.meta.glob("../convex/**/*.*s");

export function harness() {
  return convexTest(schema, modules);
}

export async function fixture() {
  const t = harness();
  await t.mutation(async (ctx) => {
    await seedIfNeeded(ctx);
    const row = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(row!._id, {
      startsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
      waiverText: "Test waiver",
      waiverVersion: "test-v1",
    });
  });
  return t;
}
