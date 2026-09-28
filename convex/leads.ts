import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { leadSchema } from "../lib/validation";
import { fail } from "./errors";
import { attributionFields } from "./map";
import { findEvent } from "./events";
import { requireActiveOrganizer } from "./organizers";
import type { MutationCtx } from "./_generated/server";

export async function saveLeadHandler(
  ctx: MutationCtx,
  eventId: string,
  input: unknown,
) {
  const data = leadSchema.parse(input);
  const event = await findEvent(ctx, eventId);
  if (!event || !event.isPublished || event.status === "draft")
    fail("Event not found.", 404);
  const duplicate = await ctx.db
    .query("futureEventLeads")
    .withIndex("by_source_email", (q) =>
      q.eq("sourceEventId", eventId).eq("email", data.email),
    )
    .unique();
  if (duplicate) return;
  const now = new Date().toISOString();
  const attribution = JSON.stringify(data.attribution);
  await ctx.db.insert("futureEventLeads", {
    leadId: crypto.randomUUID(),
    sourceEventId: eventId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    marketingConsent: data.marketingConsent,
    marketingConsentAt: data.marketingConsent ? now : null,
    attribution,
    ...attributionFields(attribution),
    createdAt: now,
  });
}

export const save = mutation({
  args: { eventId: v.string(), input: v.any() },
  handler: async (ctx, { eventId, input }) => {
    await saveLeadHandler(ctx, eventId, input);
  },
});

export const list = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const rows = await ctx.db
      .query("futureEventLeads")
      .withIndex("by_source_event", (q) => q.eq("sourceEventId", eventId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => ({
        id: row.leadId,
        first_name: row.firstName,
        last_name: row.lastName,
        email: row.email,
        phone: row.phone,
        marketing_consent: row.marketingConsent ? 1 : 0,
        marketing_consent_at: row.marketingConsentAt,
        attribution: row.attribution,
        created_at: row.createdAt,
      }));
  },
});
