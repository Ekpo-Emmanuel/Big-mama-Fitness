import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { fail } from "./errors";

export const hit = mutation({
  args: { key: v.string(), max: v.number(), now: v.number() },
  handler: async (ctx, { key, max, now }) => {
    const expired = await ctx.db.query("rateLimits").collect();
    for (const row of expired)
      if (row.resetAt < now) await ctx.db.delete(row._id);
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!existing) {
      await ctx.db.insert("rateLimits", { key, hits: 1, resetAt: now + 60000 });
      return;
    }
    const hits = existing.hits + 1;
    await ctx.db.patch(existing._id, { hits });
    if (hits > max) fail("Too many attempts. Please wait one minute.", 429);
  },
});
