import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { feedbackSchema } from "../lib/validation";
import {
  feedbackExpired,
  isFeedbackToken,
  type FeedbackSentiment,
} from "../lib/feedback";
import { fail, assertInternal } from "./errors";
import { findEvent } from "./events";
import { requireActiveOrganizer } from "./organizers";
import { randomToken } from "./map";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

async function attendeeByFeedbackToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
) {
  if (!isFeedbackToken(token)) return null;
  return ctx.db
    .query("attendees")
    .withIndex("by_feedback_token", (q) => q.eq("feedbackToken", token))
    .unique();
}

export async function ensureFeedbackToken(
  ctx: MutationCtx,
  row: Doc<"attendees">,
) {
  if (row.feedbackToken && isFeedbackToken(row.feedbackToken))
    return row.feedbackToken;
  const token = randomToken();
  await ctx.db.patch(row._id, { feedbackToken: token });
  return token;
}

function publicFeedbackState(
  event: Doc<"events">,
  attendee: Doc<"attendees">,
  existing: Doc<"eventFeedback"> | null,
  now: number,
) {
  if (attendee.eventId !== event.eventId) {
    return { status: "invalid" as const };
  }
  if (
    attendee.paymentStatus !== "paid" ||
    attendee.attendeeStatus === "cancelled"
  ) {
    return { status: "invalid" as const };
  }
  if (feedbackExpired(event.endsAt, now)) {
    return { status: "expired" as const };
  }
  return {
    status: "ok" as const,
    eventId: event.eventId,
    eventName: event.name,
    firstName: attendee.firstName,
    alreadySubmitted: Boolean(existing),
    existing: existing
      ? {
          rating: existing.rating,
          sentiment: existing.sentiment as FeedbackSentiment | null,
          enjoyedMost: existing.enjoyedMost,
          improvement: existing.improvement,
        }
      : null,
  };
}

export const resolve = query({
  args: {
    slug: v.string(),
    token: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, { slug, token, now }) => {
    const event = await findEvent(ctx, slug);
    if (!event) return { status: "invalid" as const };
    const attendee = await attendeeByFeedbackToken(ctx, token);
    if (!attendee) return { status: "invalid" as const };
    const existing = await ctx.db
      .query("eventFeedback")
      .withIndex("by_event_attendee", (q) =>
        q.eq("eventId", attendee.eventId).eq("attendeeId", attendee.attendeeId),
      )
      .unique();
    return publicFeedbackState(
      event,
      attendee,
      existing,
      now ?? Date.now(),
    );
  },
});

export async function submitFeedbackHandler(
  ctx: MutationCtx,
  eventId: string,
  input: unknown,
  now = Date.now(),
) {
  const data = feedbackSchema.parse(input);
  const event = await findEvent(ctx, eventId);
  if (!event) fail("Event not found.", 404);
  const attendee = await attendeeByFeedbackToken(ctx, data.token);
  if (!attendee || attendee.eventId !== event.eventId)
    fail("This feedback link is not valid.", 404);
  if (
    attendee.paymentStatus !== "paid" ||
    attendee.attendeeStatus === "cancelled"
  )
    fail("This feedback link is not valid.", 404);
  if (feedbackExpired(event.endsAt, now))
    fail("This feedback link has expired.", 410);

  const existing = await ctx.db
    .query("eventFeedback")
    .withIndex("by_event_attendee", (q) =>
      q.eq("eventId", event.eventId).eq("attendeeId", attendee.attendeeId),
    )
    .unique();

  const stamp = new Date(now).toISOString();
  const sentiment = data.sentiment ?? null;
  if (existing) {
    await ctx.db.patch(existing._id, {
      rating: data.rating,
      sentiment,
      enjoyedMost: data.enjoyedMost,
      improvement: data.improvement,
      updatedAt: stamp,
    });
    return { saved: true, updated: true, eventId: event.eventId };
  }

  await ctx.db.insert("eventFeedback", {
    feedbackId: crypto.randomUUID(),
    eventId: event.eventId,
    attendeeId: attendee.attendeeId,
    rating: data.rating,
    sentiment,
    enjoyedMost: data.enjoyedMost,
    improvement: data.improvement,
    submittedAt: stamp,
    updatedAt: stamp,
  });
  return { saved: true, updated: false, eventId: event.eventId };
}

export const submit = mutation({
  args: { eventId: v.string(), input: v.any() },
  handler: async (ctx, { eventId, input }) => {
    return submitFeedbackHandler(ctx, eventId, input);
  },
});

export const listForEvent = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const event = await findEvent(ctx, eventId);
    if (!event) fail("Event not found.", 404);

    // Always index by canonical eventId — never the slug/key from the URL.
    const canonicalEventId = event.eventId;

    const rows = await ctx.db
      .query("eventFeedback")
      .withIndex("by_event", (q) => q.eq("eventId", canonicalEventId))
      .collect();

    const paidGuests = (
      await ctx.db
        .query("attendees")
        .withIndex("by_event", (q) => q.eq("eventId", canonicalEventId))
        .collect()
    ).filter(
      (row) =>
        row.paymentStatus === "paid" && row.attendeeStatus !== "cancelled",
    );

    const items = [];
    for (const row of rows.sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    )) {
      const guest = await ctx.db
        .query("attendees")
        .withIndex("by_attendee_id", (q) => q.eq("attendeeId", row.attendeeId))
        .unique();
      items.push({
        id: row.feedbackId,
        firstName: guest?.firstName ?? "Guest",
        lastName: guest?.lastName ?? "",
        rating: row.rating,
        sentiment: row.sentiment,
        enjoyedMost: row.enjoyedMost,
        improvement: row.improvement,
        submittedAt: row.submittedAt,
        updatedAt: row.updatedAt,
      });
    }

    const count = rows.length;
    const average =
      count === 0
        ? null
        : Math.round(
            (rows.reduce((sum, row) => sum + row.rating, 0) / count) * 10,
          ) / 10;
    const sentimentCounts = {
      loved: 0,
      good: 0,
      okay: 0,
      not_for_me: 0,
    };
    for (const row of rows) {
      if (row.sentiment && row.sentiment in sentimentCounts)
        sentimentCounts[row.sentiment as keyof typeof sentimentCounts] += 1;
    }

    return {
      eventId: canonicalEventId,
      count,
      average,
      eligible: paidGuests.length,
      responseRate:
        paidGuests.length === 0
          ? null
          : Math.round((count / paidGuests.length) * 100),
      sentimentCounts,
      items,
    };
  },
});

/** DEV/ops: dump all feedback rows (secret-gated). */
export const dumpAll = query({
  args: { internalSecret: v.string() },
  handler: async (ctx, { internalSecret }) => {
    assertInternal(internalSecret);
    const rows = await ctx.db.query("eventFeedback").collect();
    return rows
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((row) => ({
        feedbackId: row.feedbackId,
        eventId: row.eventId,
        attendeeId: row.attendeeId,
        rating: row.rating,
        sentiment: row.sentiment,
        enjoyedMost: row.enjoyedMost,
        improvement: row.improvement,
        submittedAt: row.submittedAt,
        updatedAt: row.updatedAt,
      }));
  },
});
