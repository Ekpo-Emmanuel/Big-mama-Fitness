import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { registrationSchema } from "../lib/validation";
import {
  eventPurchaseFingerprint,
  purchaseMaterial,
  purchaseMismatchMessage,
  registrationAvailabilityMessage,
} from "../lib/event-purchase";
import { fail } from "./errors";
import { REGISTRATION_COMPLETE_MESSAGE } from "../lib/registration-intent";
import { attendeeDoc, attributionFields, randomToken, toAttendee } from "./map";
import { findEvent, seedIfNeeded, assertInternal } from "./events";
import { toDanceEvent } from "./map";
import { requireActiveOrganizer } from "./organizers";
import { postPaymentEmailJobs } from "../lib/email/schedule";
import { cancelHoldJob, scheduleJob } from "./jobs";
import type { MutationCtx } from "./_generated/server";
import type { PaymentSnapshot } from "../lib/booking";
import type { Doc } from "./_generated/dataModel";
import type { DanceEvent } from "../lib/event";


export const getAttendee = query({
  args: { attendeeId: v.string(), internalSecret: v.string() },
  handler: async (ctx, { attendeeId, internalSecret }) => {
    assertInternal(internalSecret);
    const row = await attendeeDoc(ctx, attendeeId);
    return row ? toAttendee(row) : null;
  },
});

export const confirmation = query({
  args: { token: v.string(), eventId: v.string() },
  handler: async (ctx, { token, eventId }) => {
    const row = await ctx.db
      .query("attendees")
      .withIndex("by_confirmation_token", (q) =>
        q.eq("confirmationToken", token),
      )
      .unique();
    if (!row || row.eventId !== eventId) return null;
    return {
      payment_status: row.paymentStatus,
      attendee_status: row.attendeeStatus,
    };
  },
});

export const listGuests = query({
  args: {
    eventId: v.string(),
    includePending: v.optional(v.boolean()),
  },
  handler: async (ctx, { eventId, includePending }) => {
    await requireActiveOrganizer(ctx);
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    return rows
      .map(toAttendee)
      .filter((row) => includePending || row.payment_status !== "pending")
      .sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name) ||
          a.first_name.localeCompare(b.first_name),
      );
  },
});

/** Incomplete Stripe checkouts — not real guests until paid. */
export const listPendingCheckouts = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    return rows
      .map(toAttendee)
      .filter((row) => row.payment_status === "pending")
      .sort(
        (a, b) =>
          Date.parse(b.registered_at) - Date.parse(a.registered_at) ||
          a.last_name.localeCompare(b.last_name),
      );
  },
});

export const heldAttendees = query({
  args: { internalSecret: v.string() },
  handler: async (ctx, { internalSecret }) => {
    assertInternal(internalSecret);
    const rows = await ctx.db.query("attendees").collect();
    return rows
      .filter((row) => row.inventoryStatus === "held")
      .slice(0, 100)
      .map((row) => row.attendeeId);
  },
});

export const getCheckoutRecord = query({
  args: { attendeeId: v.string() },
  handler: async (ctx, { attendeeId }) => {
    return ctx.db
      .query("checkoutRecords")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
      .unique();
  },
});

export const saveCheckoutRecord = mutation({
  args: {
    attendeeId: v.string(),
    amount: v.number(),
    params: v.string(),
    internalSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternal(args.internalSecret);
    const existing = await ctx.db
      .query("checkoutRecords")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", args.attendeeId))
      .unique();
    if (existing) {
      if (existing.amount === args.amount) return existing.params;
      await ctx.db.patch(existing._id, {
        amount: args.amount,
        params: args.params,
      });
      return args.params;
    }
    await ctx.db.insert("checkoutRecords", {
      attendeeId: args.attendeeId,
      amount: args.amount,
      params: args.params,
    });
    return args.params;
  },
});

export const clearCheckoutRecord = mutation({
  args: { attendeeId: v.string(), internalSecret: v.string() },
  handler: async (ctx, { attendeeId, internalSecret }) => {
    assertInternal(internalSecret);
    await deleteCheckoutRecord(ctx, attendeeId);
  },
});

export const attachStripeSession = mutation({
  args: {
    attendeeId: v.string(),
    stripeSessionId: v.string(),
    checkoutUrl: v.union(v.string(), v.null()),
    internalSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternal(args.internalSecret);
    const row = await attendeeDoc(ctx, args.attendeeId);
    if (!row) fail("Reservation not found.", 404);
    await ctx.db.patch(row._id, {
      stripeSessionId: args.stripeSessionId,
      checkoutUrl: args.checkoutUrl,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Capacity: soldCount and heldCount live on the event document.
 * Reserve patches that document in the same mutation as the attendee insert.
 * Convex retries the whole mutation if two writers collide on the event row.
 * The loser re-reads soldCount + heldCount and refuses the 21st seat.
 * Cancellation never decrements soldCount.
 */
export async function reserveHandler(
  ctx: MutationCtx,
  eventId: string,
  input: unknown,
) {
  await seedIfNeeded(ctx);
  const data = registrationSchema.parse(input);
  const eventRow = await findEvent(ctx, eventId);
  if (!eventRow) fail("Event not found.", 404);
  const event = toDanceEvent(eventRow);
  const canonicalId = event.id;
  const currentMaterial = purchaseMaterial(event);
  const currentFingerprint = eventPurchaseFingerprint(event);
  if (!event.waiverVersion || !event.waiverText)
    fail("Booking is not open yet.", 503);

  const previous = await ctx.db
    .query("attendees")
    .withIndex("by_request_key", (q) => q.eq("requestKey", data.requestKey))
    .unique();

  if (previous) {
    if (previous.eventId !== canonicalId)
      fail(
        "This checkout belongs to a different event. Reload the page and start again.",
        409,
      );
    if (previous.inventoryStatus === "sold")
      fail(REGISTRATION_COMPLETE_MESSAGE, 409);

    const heldSeat =
      previous.inventoryStatus === "held" ? 1 : 0;
    const blocked = registrationAvailabilityMessage(
      event,
      eventRow.soldCount,
      Math.max(0, eventRow.heldCount - heldSeat),
    );
    if (blocked) fail(blocked, 409);

    if (
      data.purchaseFingerprint &&
      data.purchaseFingerprint !== currentFingerprint
    ) {
      const seen = parsePurchaseFingerprint(data.purchaseFingerprint);
      fail(
        seen
          ? purchaseMismatchMessage(seen, currentMaterial)
          : "Event details were updated. Please reload and review before continuing.",
        409,
      );
    }

    if (data.waiverVersion !== event.waiverVersion)
      fail(
        "The participation waiver was updated. Please review and accept the latest version.",
        409,
      );

    // Stale stored fingerprint: block only when client did not send current material.
    if (
      previous.purchaseFingerprint &&
      previous.purchaseFingerprint !== currentFingerprint &&
      data.purchaseFingerprint !== currentFingerprint
    ) {
      const seen = parsePurchaseFingerprint(previous.purchaseFingerprint);
      fail(
        seen
          ? purchaseMismatchMessage(seen, currentMaterial)
          : "Event details were updated. Please reload and review before continuing.",
        409,
      );
    }

    if (previous.inventoryStatus === "released") {
      return refreshHeldReservation(ctx, previous, data, event, eventRow, true);
    }

    // Held pending: Stripe cancel / retry. Form may reload blank; contact can differ.
    return refreshHeldReservation(ctx, previous, data, event, eventRow, false);
  }

  if (
    data.purchaseFingerprint &&
    data.purchaseFingerprint !== currentFingerprint
  ) {
    const seen = parsePurchaseFingerprint(data.purchaseFingerprint);
    fail(
      seen
        ? purchaseMismatchMessage(seen, currentMaterial)
        : "Event details were updated. Please reload and review before continuing.",
      409,
    );
  }
  if (data.waiverVersion !== event.waiverVersion)
    fail(
      "The participation waiver was updated. Please review and accept the latest version.",
      409,
    );

  const now = Date.now();
  const blocked = registrationAvailabilityMessage(
    event,
    eventRow.soldCount,
    eventRow.heldCount,
    now,
  );
  if (blocked) fail(blocked, 409);

  const date = new Date(now).toISOString();
  const attendeeId = crypto.randomUUID();
  const attribution = JSON.stringify(data.attribution);
  const expiresAt = Math.floor(now / 1000) + 1860;
  await ctx.db.insert("attendees", {
    attendeeId,
    eventId: canonicalId,
    requestKey: data.requestKey,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    waiverVersion: event.waiverVersion,
    waiverText: event.waiverText,
    waiverAcceptedAt: date,
    marketingConsent: data.marketingConsent,
    marketingConsentAt: data.marketingConsent ? date : null,
    referralSource: data.referralSource,
    attribution,
    ...attributionFields(attribution),
    paymentStatus: "pending",
    attendeeStatus: "pending",
    inventoryStatus: "held",
    stripeSessionId: null,
    stripePaymentIntentId: null,
    checkoutUrl: null,
    amountPaidCents: 0,
    currency: event.currency,
    expiresAt,
    registeredAt: date,
    cancelledAt: null,
    refundedAt: null,
    checkedInAt: null,
    checkedInBy: null,
    cancelledBy: null,
    updatedBy: null,
    updatedAt: date,
    confirmationToken: randomToken(),
    feedbackToken: randomToken(),
    purchaseFingerprint: currentFingerprint,
  });
  await ctx.db.patch(eventRow._id, { heldCount: eventRow.heldCount + 1 });
  await scheduleJob(
    ctx,
    `hold_expire:${attendeeId}`,
    "hold_expire",
    attendeeId,
    expiresAt * 1000,
  );
  const created = await attendeeDoc(ctx, attendeeId);
  return toAttendee(created!);
}

function parsePurchaseFingerprint(fingerprint: string) {
  const parts = fingerprint.split("|");
  if (parts.length < 13) return null;
  return {
    eventId: parts[0],
    name: parts[1],
    priceCents: Number(parts[2]),
    currency: parts[3],
    startsAt: parts[4],
    endsAt: parts[5],
    addressLine1: parts[6],
    city: parts[7],
    province: parts[8],
    postalCode: parts[9],
    status: parts[10],
    registrationOpen: parts[11] === "1",
    waiverVersion: parts[12],
  };
}

async function deleteCheckoutRecord(ctx: MutationCtx, attendeeId: string) {
  const checkout = await ctx.db
    .query("checkoutRecords")
    .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
    .unique();
  if (checkout) await ctx.db.delete(checkout._id);
}

async function refreshHeldReservation(
  ctx: MutationCtx,
  previous: Doc<"attendees">,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    marketingConsent: boolean;
    referralSource: string;
  },
  event: DanceEvent,
  eventRow: Doc<"events">,
  rehold: boolean,
) {
  const date = new Date().toISOString();
  const now = Date.now();
  const expiresAt = Math.floor(now / 1000) + 1860;
  const emailChanged = previous.email !== data.email;
  // Keep open Stripe session on cancel-return retry. Only drop it when the
  // Checkout customer email must change, or when re-holding a released seat.
  const mustReplaceCheckout = emailChanged || rehold;

  if (mustReplaceCheckout) await deleteCheckoutRecord(ctx, previous.attendeeId);

  if (rehold) {
    await ctx.db.patch(eventRow._id, { heldCount: eventRow.heldCount + 1 });
  }

  await cancelHoldJob(ctx, previous.attendeeId);
  await scheduleJob(
    ctx,
    `hold_expire:${previous.attendeeId}`,
    "hold_expire",
    previous.attendeeId,
    expiresAt * 1000,
  );

  await ctx.db.patch(previous._id, {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    marketingConsent: data.marketingConsent,
    marketingConsentAt: data.marketingConsent
      ? previous.marketingConsentAt || date
      : null,
    referralSource: data.referralSource,
    waiverVersion: event.waiverVersion,
    waiverText: event.waiverText,
    currency: event.currency,
    purchaseFingerprint: eventPurchaseFingerprint(event),
    paymentStatus: "pending",
    attendeeStatus: "pending",
    inventoryStatus: "held",
    stripeSessionId: mustReplaceCheckout ? null : previous.stripeSessionId,
    checkoutUrl: mustReplaceCheckout ? null : previous.checkoutUrl,
    expiresAt,
    updatedAt: date,
  });

  const refreshed = await attendeeDoc(ctx, previous.attendeeId);
  return toAttendee(refreshed!);
}

export const reserve = mutation({
  args: { eventId: v.string(), input: v.any() },
  handler: async (ctx, { eventId, input }) => {
    return reserveHandler(ctx, eventId, input);
  },
});

const snapshotValidator = v.object({
  id: v.string(),
  attendeeId: v.string(),
  eventId: v.string(),
  paymentStatus: v.string(),
  status: v.union(v.string(), v.null()),
  amount: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  paymentIntent: v.union(v.string(), v.null()),
});

export const processPayment = mutation({
  args: {
    receiptId: v.string(),
    type: v.string(),
    session: snapshotValidator,
    internalSecret: v.string(),
  },
  handler: async (ctx, { receiptId, type, session, internalSecret }) => {
    assertInternal(internalSecret);
    return processPaymentHandler(ctx, receiptId, type, session);
  },
});

export const applyExpiredSession = internalMutation({
  args: {
    receiptId: v.string(),
    session: snapshotValidator,
  },
  handler: async (ctx, { receiptId, session }) => {
    return processPaymentHandler(
      ctx,
      receiptId,
      "checkout.session.expired",
      session,
    );
  },
});

export async function processPaymentHandler(
  ctx: MutationCtx,
  receiptId: string,
  type: string,
  session: PaymentSnapshot,
) {
  const seen = await ctx.db
    .query("webhookReceipts")
    .withIndex("by_receipt", (q) => q.eq("receiptId", receiptId))
    .unique();
  if (seen) return false;
  const row = await attendeeDoc(ctx, session.attendeeId);
  if (
    !row ||
    row.eventId !== session.eventId ||
    (row.stripeSessionId && row.stripeSessionId !== session.id)
  )
    throw new Error("Session does not match reservation");
  const eventRow = (await findEvent(ctx, row.eventId))!;
  const event = toDanceEvent(eventRow);
  const now = new Date().toISOString();
  if (session.paymentStatus === "paid") {
    const expected = await ctx.db
      .query("checkoutRecords")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", row.attendeeId))
      .unique();
    if (
      !expected ||
      session.amount !== expected.amount ||
      session.currency?.toUpperCase() !== row.currency ||
      !session.paymentIntent
    )
      throw new Error("Payment amount or currency mismatch");
    if (row.inventoryStatus !== "sold") {
      if (row.inventoryStatus !== "held" || eventRow.soldCount >= event.capacity)
        throw new Error("Inventory invariant violated");
      await ctx.db.patch(row._id, {
        inventoryStatus: "sold",
        paymentStatus: "paid",
        attendeeStatus: "confirmed",
        stripeSessionId: session.id,
        stripePaymentIntentId: session.paymentIntent,
        amountPaidCents: session.amount ?? 0,
        updatedAt: now,
      });
      await ctx.db.patch(eventRow._id, {
        soldCount: eventRow.soldCount + 1,
        heldCount: eventRow.heldCount - 1,
      });
      await scheduleJob(
        ctx,
        `confirmation:${row.attendeeId}`,
        "confirmation",
        row.attendeeId,
        Date.now(),
      );
      await scheduleJob(
        ctx,
        `purchase:${row.attendeeId}`,
        "purchase",
        row.attendeeId,
        Date.now(),
      );
      for (const job of postPaymentEmailJobs(event))
        await scheduleJob(
          ctx,
          `${job.kind}:${row.attendeeId}`,
          job.kind,
          row.attendeeId,
          job.dueAt,
        );
      await cancelHoldJob(ctx, row.attendeeId);
    }
  } else if (
    row.inventoryStatus === "held" &&
    (session.status === "expired" ||
      type === "checkout.session.async_payment_failed")
  ) {
    await ctx.db.patch(row._id, {
      inventoryStatus: "released",
      paymentStatus: type.endsWith("failed") ? "failed" : "cancelled",
      stripeSessionId: session.id,
      updatedAt: now,
    });
    await ctx.db.patch(eventRow._id, {
      heldCount: Math.max(0, eventRow.heldCount - 1),
    });
  }
  await ctx.db.insert("webhookReceipts", { receiptId });
  return true;
}

/**
 * Dev cleanup: collapse duplicate pending unpaid checkouts for one event.
 * Keeps the oldest pending row per email. Never touches paid/confirmed rows.
 */
export const dedupePendingCheckouts = mutation({
  args: {
    eventId: v.string(),
    internalSecret: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { eventId, internalSecret, dryRun }) => {
    assertInternal(internalSecret);
    const eventRow = await findEvent(ctx, eventId);
    if (!eventRow) fail("Event not found.", 404);

    const rows = (
      await ctx.db
        .query("attendees")
        .withIndex("by_event", (q) => q.eq("eventId", eventRow.eventId))
        .collect()
    ).filter(
      (row) =>
        row.paymentStatus === "pending" && row.inventoryStatus !== "sold",
    );

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.email.trim().toLowerCase();
      const list = groups.get(key) || [];
      list.push(row);
      groups.set(key, list);
    }

    const removed: string[] = [];
    const kept: string[] = [];
    let heldReleased = 0;

    for (const [, list] of groups) {
      if (list.length < 2) continue;
      list.sort(
        (a, b) =>
          Date.parse(a.registeredAt) - Date.parse(b.registeredAt) ||
          a.attendeeId.localeCompare(b.attendeeId),
      );
      kept.push(list[0].attendeeId);
      for (const dupe of list.slice(1)) {
        removed.push(dupe.attendeeId);
        if (dryRun) continue;
        if (dupe.inventoryStatus === "held") {
          heldReleased += 1;
          await cancelHoldJob(ctx, dupe.attendeeId);
        }
        await deleteCheckoutRecord(ctx, dupe.attendeeId);
        await ctx.db.delete(dupe._id);
      }
    }

    if (!dryRun && heldReleased > 0) {
      await ctx.db.patch(eventRow._id, {
        heldCount: Math.max(0, eventRow.heldCount - heldReleased),
      });
    }

    return {
      dryRun: Boolean(dryRun),
      kept,
      removed,
      heldReleased: dryRun ? heldReleased : heldReleased,
    };
  },
});

/**
 * Explicit cleanup: delete named unpaid released/cancelled attendees.
 * Never deletes paid/sold/held rows. Recalculates heldCount from live holds.
 */
export const deleteReleasedAttendeesById = mutation({
  args: {
    eventId: v.string(),
    attendeeIds: v.array(v.string()),
    keepAttendeeId: v.string(),
    internalSecret: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertInternal(args.internalSecret);
    const eventRow = await findEvent(ctx, args.eventId);
    if (!eventRow) fail("Event not found.", 404);

    const all = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", eventRow.eventId))
      .collect();

    const byId = new Map(all.map((row) => [row.attendeeId, row]));
    const keep = byId.get(args.keepAttendeeId);
    if (!keep) fail("Keep attendee not found.", 404);
    if (keep.paymentStatus === "paid" || keep.inventoryStatus === "sold") {
      fail("Keep attendee is paid/sold; abort.", 409);
    }

    const deleteSet = new Set(args.attendeeIds);
    if (deleteSet.has(args.keepAttendeeId)) {
      fail("keepAttendeeId must not be in attendeeIds.", 400);
    }

    const toDelete = [];
    for (const id of args.attendeeIds) {
      const row = byId.get(id);
      if (!row) fail(`Attendee not found: ${id}`, 404);
      if (row.eventId !== eventRow.eventId) {
        fail(`Attendee ${id} belongs to another event.`, 400);
      }
      if (row.paymentStatus === "paid" || row.inventoryStatus === "sold") {
        fail(`Refusing paid/sold attendee: ${id}`, 409);
      }
      if (row.inventoryStatus === "held") {
        fail(`Refusing held attendee: ${id}`, 409);
      }
      if (
        row.paymentStatus !== "cancelled" &&
        row.paymentStatus !== "failed"
      ) {
        fail(
          `Refusing attendee ${id}: paymentStatus=${row.paymentStatus}`,
          409,
        );
      }
      if (row.inventoryStatus !== "released") {
        fail(
          `Refusing attendee ${id}: inventoryStatus=${row.inventoryStatus}`,
          409,
        );
      }
      toDelete.push(row);
    }

    if (!args.dryRun) {
      for (const row of toDelete) {
        await cancelHoldJob(ctx, row.attendeeId);
        await deleteCheckoutRecord(ctx, row.attendeeId);
        await ctx.db.delete(row._id);
      }

      const remaining = await ctx.db
        .query("attendees")
        .withIndex("by_event", (q) => q.eq("eventId", eventRow.eventId))
        .collect();
      const heldCount = remaining.filter(
        (row) => row.inventoryStatus === "held",
      ).length;
      const soldCount = remaining.filter(
        (row) => row.inventoryStatus === "sold",
      ).length;
      await ctx.db.patch(eventRow._id, { heldCount, soldCount });
    }

    return {
      dryRun: Boolean(args.dryRun),
      kept: args.keepAttendeeId,
      deleted: toDelete.map((row) => row.attendeeId),
      eventId: eventRow.eventId,
    };
  },
});

