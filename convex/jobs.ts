import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fail, assertInternal } from "./errors";
import { attendeeDoc, toAttendee, toDanceEvent } from "./map";
import { findEvent } from "./events";
import { requireActiveOrganizer } from "./organizers";
import { composeEmail, emailKinds } from "../lib/email/compose";
import { ensureFeedbackToken } from "./feedback";
import { uniqueEmails } from "../lib/email/recipients";
import { shouldApplyDeliveryStatus } from "../lib/resend-delivery";
import type { MutationCtx } from "./_generated/server";
import type { EmailMessage } from "../lib/email/provider";

const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

function dispatchRef(kind: string) {
  if (kind === "purchase") return internal.purchaseAction.send;
  if (kind === "hold_expire") return internal.holdAction.check;
  return internal.emailAction.send;
}

export async function scheduleJob(
  ctx: MutationCtx,
  jobId: string,
  kind: string,
  attendeeId: string | null,
  dueAt: number,
) {
  const existing = await ctx.db
    .query("jobs")
    .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
    .unique();
  if (existing) {
    if (existing.status === "pending" || existing.status === "processing") return;
    if (existing.scheduledFunctionId) {
      try {
        await ctx.scheduler.cancel(existing.scheduledFunctionId);
      } catch {
        // Already finished or cancelled.
      }
    }
    const scheduledFunctionId =
      dueAt <= Date.now()
        ? await ctx.scheduler.runAfter(0, dispatchRef(kind), { jobId })
        : await ctx.scheduler.runAt(dueAt, dispatchRef(kind), { jobId });
    await ctx.db.patch(existing._id, {
      dueAt,
      status: "pending",
      attempts: 0,
      lockedUntil: 0,
      lastError: null,
      scheduledFunctionId,
      attendeeId,
    });
    return;
  }
  const id = await ctx.db.insert("jobs", {
    jobId,
    kind,
    attendeeId,
    payload: "{}",
    dueAt,
    status: "pending",
    attempts: 0,
    lockedUntil: 0,
    lastError: null,
  });
  const scheduledFunctionId =
    dueAt <= Date.now()
      ? await ctx.scheduler.runAfter(0, dispatchRef(kind), { jobId })
      : await ctx.scheduler.runAt(dueAt, dispatchRef(kind), { jobId });
  await ctx.db.patch(id, { scheduledFunctionId });
}

export async function cancelAttendeeMail(ctx: MutationCtx, attendeeId: string) {
  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
    .collect();
  for (const job of jobs) {
    if (job.kind === "purchase" || job.kind === "hold_expire") continue;
    if (job.status === "sent" || job.status === "skipped") continue;
    if (job.scheduledFunctionId) {
      await ctx.scheduler.cancel(job.scheduledFunctionId);
    }
    await ctx.db.patch(job._id, {
      status: "skipped",
      lockedUntil: 0,
      lastError: "Cancelled with attendee status",
      scheduledFunctionId: undefined,
    });
  }
}

export async function cancelHoldJob(ctx: MutationCtx, attendeeId: string) {
  const job = await ctx.db
    .query("jobs")
    .withIndex("by_job_id", (q) => q.eq("jobId", `hold_expire:${attendeeId}`))
    .unique();
  if (!job || job.status === "sent" || job.status === "skipped") return;
  if (job.scheduledFunctionId) await ctx.scheduler.cancel(job.scheduledFunctionId);
  await ctx.db.patch(job._id, {
    status: "skipped",
    lockedUntil: 0,
    scheduledFunctionId: undefined,
  });
}

async function composeJobMessage(
  ctx: MutationCtx,
  kind: string,
  attendeeId: string,
) {
  const row = await attendeeDoc(ctx, attendeeId);
  if (!row) return null;
  const eventRow = await findEvent(ctx, row.eventId);
  if (!eventRow) return null;
  if (kind === "followup") {
    await ensureFeedbackToken(ctx, row);
  }
  const fresh = (await attendeeDoc(ctx, attendeeId))!;
  const organizers = (await ctx.db.query("organizers").collect())
    .filter((organizer) => organizer.isActive)
    .map((organizer) => organizer.email);
  const composed = composeEmail({
    kind,
    attendee: toAttendee(fresh),
    event: toDanceEvent(eventRow),
    sold: eventRow.soldCount,
    organizerEmails: uniqueEmails([
      ...organizers,
      process.env.ORGANIZER_EMAIL,
      eventRow.contactEmail,
    ]),
  });
  if (!composed) return null;
  const reply =
    process.env.EMAIL_REPLY_TO ||
    eventRow.contactEmail ||
    process.env.ORGANIZER_EMAIL;
  return {
    from: process.env.EMAIL_FROM || "",
    to: composed.to,
    subject: composed.subject,
    text: composed.text,
    html: composed.html,
    ...(reply ? { reply_to: reply } : {}),
  } satisfies EmailMessage;
}

export async function recordDeliveryHandler(
  ctx: MutationCtx,
  args: {
    jobId: string;
    eventId: string;
    attendeeId: string;
    type: string;
    deliveries: {
      recipient: string;
      providerMessageId: string | null;
    }[];
    status: string;
    errorMessage: string | null;
  },
) {
  const now = Date.now();
  const job = await ctx.db
    .query("jobs")
    .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
    .unique();
  if (job && args.status === "sent") {
    const ids = args.deliveries
      .map((row) => row.providerMessageId)
      .filter((id): id is string => Boolean(id));
    await ctx.db.patch(job._id, {
      providerMessageId: ids.length === 1 ? ids[0] : null,
      recipient: args.deliveries.map((row) => row.recipient).join(", "),
      sentAt: now,
    });
  }
  const rows =
    args.deliveries.length > 0
      ? args.deliveries
      : [{ recipient: "", providerMessageId: null as string | null }];
  for (const delivery of rows) {
    await ctx.db.insert("emailDeliveries", {
      deliveryId: `${args.jobId}:${delivery.recipient}:${now}:${args.status}`,
      jobId: args.jobId,
      eventId: args.eventId,
      attendeeId: args.attendeeId || null,
      type: args.type,
      recipient: delivery.recipient,
      providerMessageId: delivery.providerMessageId,
      status: args.status,
      sentAt: args.status === "sent" ? now : null,
      failedAt: args.status === "failed" ? now : null,
      errorMessage: args.errorMessage,
    });
  }
}

export async function prepareSendHandler(ctx: MutationCtx, jobId: string, now = Date.now()) {
  const job = await ctx.db
    .query("jobs")
    .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
    .unique();
  if (!job) return null;
  if (["sent", "skipped", "needs_review"].includes(job.status)) return null;
  if (job.status === "processing" && job.lockedUntil > now) return null;
  const payload = JSON.parse(job.payload) as {
    firstAttemptAt?: number;
    message?: EmailMessage;
  };
  const firstAttemptAt = job.firstAttemptAt ?? payload.firstAttemptAt;
  if (firstAttemptAt && now - firstAttemptAt > RETRY_WINDOW_MS) {
    await ctx.db.patch(job._id, {
      status: "needs_review",
      lastError: "Retry window exceeded; check provider before replay",
    });
    return null;
  }
  let message = payload.message;
  if ((emailKinds as string[]).includes(job.kind)) {
    if (!job.attendeeId) {
      await ctx.db.patch(job._id, { status: "skipped", lastError: null });
      return null;
    }
    const current = await composeJobMessage(ctx, job.kind, job.attendeeId);
    if (!current) {
      await ctx.db.patch(job._id, {
        status: "skipped",
        lockedUntil: 0,
        lastError: null,
        scheduledFunctionId: undefined,
      });
      await recordDeliveryHandler(ctx, {
        jobId,
        eventId: "",
        attendeeId: job.attendeeId,
        type: job.kind,
        deliveries: [],
        status: "skipped",
        errorMessage: null,
      });
      return null;
    }
    message = payload.message || current;
  }
  const updated = JSON.stringify({
    ...payload,
    firstAttemptAt: firstAttemptAt || now,
    ...(message ? { message } : {}),
  });
  await ctx.db.patch(job._id, {
    status: "processing",
    lockedUntil: now + 5 * 60000,
    attempts: job.attempts + 1,
    payload: updated,
    firstAttemptAt: firstAttemptAt || now,
  });
  return {
    jobId,
    kind: job.kind,
    attendeeId: job.attendeeId || "",
    message: message ?? null,
    attempts: job.attempts + 1,
  };
}

export const unresolvedCount = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("jobs").collect();
    return rows.filter((job) => job.status !== "sent" && job.status !== "skipped")
      .length;
  },
});

export const get = query({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    return ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .unique();
  },
});

export const prepareSend = internalMutation({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => prepareSendHandler(ctx, jobId),
});

export const markSent = internalMutation({
  args: {
    jobId: v.string(),
    deliveries: v.array(
      v.object({
        recipient: v.string(),
        providerMessageId: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .unique();
    if (!job) return;
    const person = job.attendeeId ? await attendeeDoc(ctx, job.attendeeId) : null;
    await ctx.db.patch(job._id, {
      status: "sent",
      lockedUntil: 0,
      lastError: null,
      sentAt: Date.now(),
      scheduledFunctionId: undefined,
    });
    await recordDeliveryHandler(ctx, {
      jobId: args.jobId,
      eventId: person?.eventId || "",
      attendeeId: job.attendeeId || "",
      type: job.kind,
      deliveries: args.deliveries,
      status: "sent",
      errorMessage: null,
    });
  },
});

export const markFailed = internalMutation({
  args: { jobId: v.string(), error: v.string() },
  handler: async (ctx, { jobId, error }) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .unique();
    if (!job) return;
    const person = job.attendeeId ? await attendeeDoc(ctx, job.attendeeId) : null;
    await recordDeliveryHandler(ctx, {
      jobId,
      eventId: person?.eventId || "",
      attendeeId: job.attendeeId || "",
      type: job.kind,
      deliveries: [],
      status: "failed",
      errorMessage: error,
    });
    const firstAttemptAt = job.firstAttemptAt || Date.now();
    if (Date.now() - firstAttemptAt > RETRY_WINDOW_MS) {
      await ctx.db.patch(job._id, {
        status: "needs_review",
        lockedUntil: 0,
        lastError: "Retry window exceeded; check provider before replay",
        scheduledFunctionId: undefined,
      });
      return;
    }
    const delay = Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6));
    const scheduledFunctionId = await ctx.scheduler.runAfter(
      delay,
      dispatchRef(job.kind),
      { jobId },
    );
    await ctx.db.patch(job._id, {
      status: "pending",
      lockedUntil: 0,
      dueAt: Date.now() + delay,
      lastError: "Delivery failed; retry scheduled",
      scheduledFunctionId,
    });
  },
});

export const markSkipped = internalMutation({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .unique();
    if (!job) return;
    await ctx.db.patch(job._id, {
      status: "skipped",
      lockedUntil: 0,
      lastError: null,
      scheduledFunctionId: undefined,
    });
  },
});

export const confirmationByEvent = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const people = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    const ids = new Set(people.map((row) => row.attendeeId));
    const jobs = (await ctx.db.query("jobs").collect()).filter(
      (job) => job.kind === "confirmation" && job.attendeeId && ids.has(job.attendeeId),
    );
    const latest: Record<
      string,
      { status: string; lastError: string | null }
    > = {};
    for (const job of jobs.sort((a, b) => a.dueAt - b.dueAt)) {
      if (job.attendeeId)
        latest[job.attendeeId] = {
          status: job.status,
          lastError: job.lastError,
        };
    }
    return latest;
  },
});

export async function retryConfirmationHandler(
  ctx: MutationCtx,
  attendeeId: string,
) {
  const row = await attendeeDoc(ctx, attendeeId);
  if (!row) fail("Guest not found.", 404);
  if (row.paymentStatus !== "paid" || row.attendeeStatus === "cancelled")
    fail("Only paid, active tickets can receive confirmation email.", 409);
  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
    .collect();
  const confirmation = jobs.filter((job) => job.kind === "confirmation");
  if (confirmation.some((job) => job.status === "pending" || job.status === "processing"))
    fail("A confirmation email is already queued.", 409);
  if (confirmation.some((job) => job.status === "sent"))
    fail("Confirmation email already sent.", 409);
  const jobId = `confirmation:${attendeeId}:retry:${Date.now()}`;
  await scheduleJob(ctx, jobId, "confirmation", attendeeId, Date.now());
  return row.eventId;
}

export const retryConfirmation = mutation({
  args: { attendeeId: v.string() },
  handler: async (ctx, { attendeeId }) => {
    await requireActiveOrganizer(ctx);
    return retryConfirmationHandler(ctx, attendeeId);
  },
});

export const holdSnapshot = internalQuery({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .unique();
    if (!job?.attendeeId) return null;
    const row = await attendeeDoc(ctx, job.attendeeId);
    if (!row) return null;
    return {
      attendeeId: row.attendeeId,
      inventoryStatus: row.inventoryStatus,
      stripeSessionId: row.stripeSessionId,
    };
  },
});

export const purchaseSnapshot = internalMutation({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    const prepared = await prepareSendHandler(ctx, jobId);
    if (!prepared?.attendeeId) return null;
    const row = await attendeeDoc(ctx, prepared.attendeeId);
    const eventRow = row ? await findEvent(ctx, row.eventId) : null;
    if (!row || row.inventoryStatus !== "sold" || !row.stripePaymentIntentId || !eventRow) {
      const job = await ctx.db
        .query("jobs")
        .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
        .unique();
      if (job)
        await ctx.db.patch(job._id, {
          status: "skipped",
          lockedUntil: 0,
          lastError: null,
          scheduledFunctionId: undefined,
        });
      return null;
    }
    return {
      jobId,
      attendeeId: row.attendeeId,
      eventId: eventRow.eventId,
      eventName: eventRow.name,
      amount: row.amountPaidCents,
      currency: row.currency,
      paymentIntent: row.stripePaymentIntentId,
      attribution: row.attribution,
      registeredAt: row.registeredAt,
    };
  },
});

export async function applyResendDeliveryEventHandler(
  ctx: MutationCtx,
  args: {
    receiptId: string;
    providerMessageId: string;
    status: string;
    errorMessage: string | null;
  },
) {
  const existing = await ctx.db
    .query("webhookReceipts")
    .withIndex("by_receipt", (q) => q.eq("receiptId", args.receiptId))
    .unique();
  if (existing) return { applied: false, reason: "duplicate" as const };

  const deliveries = await ctx.db
    .query("emailDeliveries")
    .withIndex("by_provider_message_id", (q) =>
      q.eq("providerMessageId", args.providerMessageId),
    )
    .collect();

  let updated = 0;
  for (const row of deliveries) {
    if (!shouldApplyDeliveryStatus(row.status, args.status)) continue;
    const terminal = ["bounced", "complained", "suppressed", "failed"].includes(
      args.status,
    );
    await ctx.db.patch(row._id, {
      status: args.status,
      errorMessage: args.errorMessage ?? row.errorMessage,
      failedAt: terminal ? Date.now() : row.failedAt,
      sentAt: args.status === "sent" && !row.sentAt ? Date.now() : row.sentAt,
    });
    updated += 1;
  }

  await ctx.db.insert("webhookReceipts", { receiptId: args.receiptId });
  return { applied: true, updated };
}

export const applyResendDeliveryEvent = mutation({
  args: {
    receiptId: v.string(),
    providerMessageId: v.string(),
    status: v.string(),
    errorMessage: v.union(v.string(), v.null()),
    internalSecret: v.string(),
  },
  handler: async (ctx, { internalSecret, ...args }) => {
    assertInternal(internalSecret);
    return applyResendDeliveryEventHandler(ctx, args);
  },
});
