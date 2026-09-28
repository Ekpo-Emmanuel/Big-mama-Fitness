import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { initialEvent } from "../lib/event";
import { eventConfigSchema } from "../lib/event-config";
import { assertInternal } from "./errors";
import { fromDanceEvent, toDanceEvent } from "./map";
import { requireActiveOrganizer } from "./organizers";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function findEvent(ctx: QueryCtx | MutationCtx, key: string) {
  const byId = await ctx.db
    .query("events")
    .withIndex("by_event_id", (q) => q.eq("eventId", key))
    .unique();
  if (byId) return byId;
  return ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", key))
    .unique();
}

export async function seedIfNeeded(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
    .unique();
  if (existing) {
    const needsApprovedWaiver =
      !existing.waiverText ||
      !existing.waiverVersion ||
      existing.waiverVersion === "local-test-v1" ||
      existing.waiverText.includes("LOCAL TEST WAIVER ONLY");
    if (needsApprovedWaiver && initialEvent.waiverText && initialEvent.waiverVersion) {
      await ctx.db.patch(existing._id, {
        waiverVersion: initialEvent.waiverVersion,
        waiverText: initialEvent.waiverText,
        updatedAt: new Date().toISOString(),
      });
      return (await ctx.db.get(existing._id))!;
    }
    return existing;
  }
  const id = await ctx.db.insert("events", fromDanceEvent(initialEvent));
  return (await ctx.db.get(id))!;
}

export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    await seedIfNeeded(ctx);
  },
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await findEvent(ctx, key);
    if (row) return toDanceEvent(row);
    if (key === initialEvent.id || key === initialEvent.slug) return initialEvent;
    return null;
  },
});

export const inventory = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const row = await findEvent(ctx, eventId);
    if (!row) return { sold: 0, held: 0 };
    return { sold: row.soldCount, held: row.heldCount };
  },
});

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("events").collect();
    const published = rows
      .filter((row) => row.isPublished && row.status !== "draft")
      .map((row) => ({
        event: toDanceEvent(row),
        updatedAt: row.updatedAt,
      }));
    if (published.length) return published;
    if (initialEvent.isPublished && initialEvent.status !== "draft")
      return [{ event: initialEvent, updatedAt: initialEvent.startsAt }];
    return [];
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveOrganizer(ctx);
    const rows = await ctx.db.query("events").collect();
    return rows.map(toDanceEvent);
  },
});

export const overview = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const event = await findEvent(ctx, eventId);
    if (!event) return null;
    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", event.eventId))
      .collect();
    const leads = await ctx.db
      .query("futureEventLeads")
      .withIndex("by_source_event", (q) => q.eq("sourceEventId", event.eventId))
      .collect();
    const jobs = await ctx.db.query("jobs").collect();
    let expected = 0,
      checked = 0,
      absent = 0,
      cancelled = 0,
      gross = 0,
      net = 0;
    for (const row of attendees) {
      if (
        ["confirmed", "checked_in"].includes(row.attendeeStatus) &&
        row.paymentStatus === "paid"
      )
        expected++;
      if (row.attendeeStatus === "checked_in") checked++;
      if (row.attendeeStatus === "no_show") absent++;
      if (row.attendeeStatus === "cancelled") cancelled++;
      if (row.inventoryStatus === "sold") gross += row.amountPaidCents;
      if (row.paymentStatus === "paid") net += row.amountPaidCents;
    }
    return {
      event: toDanceEvent(event),
      sold: event.soldCount,
      held: event.heldCount,
      expected,
      checked,
      absent,
      cancelled,
      gross,
      net,
      leads: leads.length,
      jobs: jobs.filter((job) => job.status !== "sent" && job.status !== "skipped")
        .length,
    };
  },
});

export const saveConfig = mutation({
  args: { inputJson: v.string(), internalSecret: v.string() },
  handler: async (ctx, { inputJson, internalSecret }) => {
    assertInternal(internalSecret);
    const event = eventConfigSchema.parse(JSON.parse(inputJson));
    const existing = await findEvent(ctx, event.id);
    const sold = existing?.soldCount ?? 0;
    const held = existing?.heldCount ?? 0;
    if (held > 0)
      throw new Error(
        "Resolve active Stripe checkouts before changing event configuration.",
      );
    if (sold > event.capacity)
      throw new Error("Capacity cannot be lower than tickets already sold.");
    const payload = fromDanceEvent(event, {
      soldCount: sold,
      heldCount: held,
      updatedAt: new Date().toISOString(),
    });
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("events", payload);
    return event;
  },
});

export { assertInternal } from "./errors";
