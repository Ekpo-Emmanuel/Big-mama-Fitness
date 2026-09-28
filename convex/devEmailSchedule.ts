import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { fail, assertInternal } from "./errors";
import { fromDanceEvent, randomToken, toAttendee } from "./map";
import { scheduleJob, prepareSendHandler } from "./jobs";
import { updateGuestHandler } from "./guests";
import {
  compressedProbeTimeline,
  followupOnlyProbeTimeline,
} from "../lib/email/dev-compressed-schedule";
import { feedbackPageUrl } from "../lib/feedback";
import { initialEvent } from "../lib/event";
import type { DanceEvent } from "../lib/event";
import type { MutationCtx } from "./_generated/server";

const PROBE_EVENT_ID = "email-schedule-probe";
const PROBE_SLUG = "email-schedule-probe";
const FOLLOWUP_PROBE_EVENT_ID = "followup-email-probe";
const FOLLOWUP_PROBE_SLUG = "followup-email-probe";

function assertDevEmailScheduleAllowed() {
  if (process.env.EMAIL_PRODUCTION === "true")
    fail("Dev email schedule probe is blocked when EMAIL_PRODUCTION=true.", 403);
}

function probeEvent(timeline: {
  startsAtMs: number;
  endsAtMs: number;
}): DanceEvent {
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    ...initialEvent,
    id: PROBE_EVENT_ID,
    slug: PROBE_SLUG,
    name: "DEV Email Schedule Probe",
    shortName: "Email Probe",
    headline: "DEV ONLY — compressed reminder schedule",
    subheadline: "Not a real class. Safe to delete.",
    description:
      "Temporary Convex DEV probe for reminder and follow-up email timing.",
    startsAt: iso(timeline.startsAtMs),
    endsAt: iso(timeline.endsAtMs),
    workoutStartsAt: iso(timeline.startsAtMs + 60_000),
    workoutEndsAt: iso(timeline.endsAtMs - 60_000),
    timezone: "America/Vancouver",
    status: "published",
    isPublished: true,
    registrationOpen: false,
    capacity: 10,
    waiverVersion: "dev-probe-v1",
    waiverText: "DEV probe waiver only. Not a legal document.",
    contactEmail: initialEvent.contactEmail || "info@bigmamafit.ca",
  };
}

function followupProbeEvent(timeline: {
  startsAtMs: number;
  endsAtMs: number;
}): DanceEvent {
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    ...initialEvent,
    id: FOLLOWUP_PROBE_EVENT_ID,
    slug: FOLLOWUP_PROBE_SLUG,
    name: "DEV Follow-up Email Probe",
    shortName: "Follow-up Probe",
    headline: "DEV ONLY — follow-up + Rate the class",
    subheadline: "Not a real class. Safe to delete.",
    description:
      "Temporary Convex DEV probe for post-event follow-up email and feedback CTA.",
    startsAt: iso(timeline.startsAtMs),
    endsAt: iso(timeline.endsAtMs),
    workoutStartsAt: iso(timeline.startsAtMs + 60_000),
    workoutEndsAt: iso(timeline.endsAtMs - 60_000),
    timezone: "America/Vancouver",
    status: "completed",
    isPublished: true,
    registrationOpen: false,
    capacity: 10,
    waiverVersion: "dev-probe-v1",
    waiverText: "DEV probe waiver only. Not a legal document.",
    contactEmail: initialEvent.contactEmail || "info@bigmamafit.ca",
  };
}

async function upsertEvent(ctx: MutationCtx, event: DanceEvent) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_event_id", (q) => q.eq("eventId", event.id))
    .unique();
  const payload = fromDanceEvent(event, {
    soldCount: existing?.soldCount ?? 0,
    heldCount: 0,
    updatedAt: new Date().toISOString(),
  });
  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }
  return ctx.db.insert("events", payload);
}

async function insertPaidGuest(
  ctx: MutationCtx,
  args: {
    eventId: string;
    email: string;
    firstName: string;
    lastName: string;
    label: string;
  },
) {
  const now = new Date().toISOString();
  const attendeeId = crypto.randomUUID();
  const feedbackToken = randomToken();
  await ctx.db.insert("attendees", {
    attendeeId,
    eventId: args.eventId,
    requestKey: crypto.randomUUID(),
    firstName: args.firstName,
    lastName: args.lastName,
    email: args.email,
    phone: "2505550100",
    waiverVersion: "dev-probe-v1",
    waiverText: "DEV probe waiver only.",
    waiverAcceptedAt: now,
    marketingConsent: false,
    marketingConsentAt: null,
    referralSource: args.label,
    attribution: "{}",
    paymentStatus: "paid",
    attendeeStatus: "confirmed",
    inventoryStatus: "sold",
    stripeSessionId: null,
    stripePaymentIntentId: `pi_dev_probe_${attendeeId.slice(0, 8)}`,
    checkoutUrl: null,
    amountPaidCents: 1000,
    currency: "CAD",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    registeredAt: now,
    cancelledAt: null,
    refundedAt: null,
    checkedInAt: null,
    checkedInBy: null,
    cancelledBy: null,
    updatedBy: null,
    updatedAt: now,
    confirmationToken: randomToken(),
    feedbackToken,
  });
  return { attendeeId, feedbackToken };
}

/** Seed compressed DEV probe event + two paid guests + three scheduled emails each. */
export const seedProbe = mutation({
  args: {
    internalSecret: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { internalSecret, email }) => {
    assertInternal(internalSecret);
    assertDevEmailScheduleAllowed();
    const to = email.trim().toLowerCase();
    if (!to.includes("@")) fail("Valid test inbox email required.", 400);

    const timeline = compressedProbeTimeline(Date.now());
    const event = probeEvent(timeline);
    await upsertEvent(ctx, event);

    const eventRow = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", PROBE_EVENT_ID))
      .unique();
    if (!eventRow) fail("Probe event missing after upsert.", 500);

    const keep = await insertPaidGuest(ctx, {
      eventId: PROBE_EVENT_ID,
      email: to,
      firstName: "Keep",
      lastName: "Probe",
      label: "schedule-keep",
    });
    const cancel = await insertPaidGuest(ctx, {
      eventId: PROBE_EVENT_ID,
      email: to,
      firstName: "Cancel",
      lastName: "Probe",
      label: "schedule-cancel",
    });

    await ctx.db.patch(eventRow._id, {
      soldCount: eventRow.soldCount + 2,
      heldCount: 0,
    });

    const kinds = [
      { kind: "reminder_24", dueAt: timeline.reminder_24_at },
      { kind: "reminder_3", dueAt: timeline.reminder_3_at },
      { kind: "followup", dueAt: timeline.followup_at },
    ] as const;

    for (const attendeeId of [keep.attendeeId, cancel.attendeeId]) {
      for (const job of kinds) {
        await scheduleJob(
          ctx,
          `${job.kind}:${attendeeId}`,
          job.kind,
          attendeeId,
          job.dueAt,
        );
      }
    }

    const jobs = [];
    for (const attendeeId of [keep.attendeeId, cancel.attendeeId]) {
      for (const job of kinds) {
        const row = await ctx.db
          .query("jobs")
          .withIndex("by_job_id", (q) =>
            q.eq("jobId", `${job.kind}:${attendeeId}`),
          )
          .unique();
        jobs.push({
          jobId: row!.jobId,
          kind: row!.kind,
          attendeeId,
          dueAt: row!.dueAt,
          status: row!.status,
          scheduledFunctionId: row!.scheduledFunctionId ?? null,
        });
      }
    }

    return {
      eventId: PROBE_EVENT_ID,
      slug: PROBE_SLUG,
      timeline: {
        now: new Date(timeline.now).toISOString(),
        reminder_24_at: new Date(timeline.reminder_24_at).toISOString(),
        reminder_3_at: new Date(timeline.reminder_3_at).toISOString(),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        followup_at: new Date(timeline.followup_at).toISOString(),
      },
      keepAttendeeId: keep.attendeeId,
      cancelAttendeeId: cancel.attendeeId,
      email: to,
      jobs,
    };
  },
});

/** DEV-only: one paid guest + follow-up email only (no 24h/3h). */
export const seedFollowupProbe = mutation({
  args: {
    internalSecret: v.string(),
    email: v.string(),
    delayMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { internalSecret, email, delayMinutes }) => {
    assertInternal(internalSecret);
    assertDevEmailScheduleAllowed();
    const to = email.trim().toLowerCase();
    if (!to.includes("@")) fail("Valid test inbox email required.", 400);

    const timeline = followupOnlyProbeTimeline(delayMinutes ?? 2, Date.now());
    const event = followupProbeEvent(timeline);
    await upsertEvent(ctx, event);

    const eventRow = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", FOLLOWUP_PROBE_EVENT_ID))
      .unique();
    if (!eventRow) fail("Follow-up probe event missing after upsert.", 500);

    const guest = await insertPaidGuest(ctx, {
      eventId: FOLLOWUP_PROBE_EVENT_ID,
      email: to,
      firstName: "Followup",
      lastName: "Probe",
      label: "followup-only",
    });

    await ctx.db.patch(eventRow._id, {
      soldCount: eventRow.soldCount + 1,
      heldCount: 0,
    });

    const jobId = `followup:${guest.attendeeId}`;
    await scheduleJob(
      ctx,
      jobId,
      "followup",
      guest.attendeeId,
      timeline.followup_at,
    );

    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .unique();
    if (!job) fail("Follow-up job missing after schedule.", 500);

    const feedbackUrl = feedbackPageUrl(
      { slug: FOLLOWUP_PROBE_SLUG },
      guest.feedbackToken,
    );

    return {
      eventId: FOLLOWUP_PROBE_EVENT_ID,
      slug: FOLLOWUP_PROBE_SLUG,
      attendeeId: guest.attendeeId,
      email: to,
      feedbackToken: guest.feedbackToken,
      feedbackUrl,
      timeline: {
        now: new Date(timeline.now).toISOString(),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        followup_at: new Date(timeline.followup_at).toISOString(),
        delayMinutes: timeline.delayMinutes,
      },
      job: {
        jobId: job.jobId,
        kind: job.kind,
        dueAt: job.dueAt,
        status: job.status,
        scheduledFunctionId: job.scheduledFunctionId ?? null,
      },
    };
  },
});

export const followupProbeStatus = query({
  args: {
    internalSecret: v.string(),
    attendeeId: v.string(),
  },
  handler: async (ctx, { internalSecret, attendeeId }) => {
    assertInternal(internalSecret);
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", `followup:${attendeeId}`))
      .unique();
    const guest = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", attendeeId))
      .unique();
    const deliveries = (await ctx.db.query("emailDeliveries").collect()).filter(
      (row) => row.attendeeId === attendeeId && row.type === "followup",
    );
    const feedback = await ctx.db
      .query("eventFeedback")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
      .unique();
    const reminderJobs = (
      await Promise.all(
        ["reminder_24", "reminder_3"].map(async (kind) => {
          const row = await ctx.db
            .query("jobs")
            .withIndex("by_job_id", (q) =>
              q.eq("jobId", `${kind}:${attendeeId}`),
            )
            .unique();
          return row
            ? { jobId: row.jobId, kind: row.kind, status: row.status }
            : null;
        }),
      )
    ).filter(Boolean);

    return {
      checkedAt: Date.now(),
      feedbackToken: guest?.feedbackToken ?? null,
      feedbackUrl:
        guest?.feedbackToken
          ? feedbackPageUrl({ slug: FOLLOWUP_PROBE_SLUG }, guest.feedbackToken)
          : null,
      job: job
        ? {
            jobId: job.jobId,
            kind: job.kind,
            dueAt: job.dueAt,
            status: job.status,
            attempts: job.attempts,
            lastError: job.lastError,
            sentAt: job.sentAt ?? null,
            scheduledFunctionId: job.scheduledFunctionId ?? null,
            providerMessageId: job.providerMessageId ?? null,
            recipient: job.recipient ?? null,
          }
        : null,
      deliveries: deliveries.map((row) => ({
        deliveryId: row.deliveryId,
        status: row.status,
        recipient: row.recipient,
        providerMessageId: row.providerMessageId,
        sentAt: row.sentAt,
        errorMessage: row.errorMessage,
      })),
      reminderJobsScheduled: reminderJobs,
      feedbackRow: feedback
        ? {
            feedbackId: feedback.feedbackId,
            rating: feedback.rating,
            sentiment: feedback.sentiment,
            submittedAt: feedback.submittedAt,
          }
        : null,
    };
  },
});

export const cancelProbeGuest = mutation({
  args: {
    internalSecret: v.string(),
    attendeeId: v.string(),
  },
  handler: async (ctx, { internalSecret, attendeeId }) => {
    assertInternal(internalSecret);
    assertDevEmailScheduleAllowed();
    await updateGuestHandler(ctx, attendeeId, "cancel", "dev-schedule-probe");
    return { attendeeId, cancelled: true };
  },
});

export const probeStatus = query({
  args: {
    internalSecret: v.string(),
    keepAttendeeId: v.string(),
    cancelAttendeeId: v.string(),
  },
  handler: async (ctx, { internalSecret, keepAttendeeId, cancelAttendeeId }) => {
    assertInternal(internalSecret);
    const ids = [keepAttendeeId, cancelAttendeeId];
    const jobs = (
      await Promise.all(
        ids.flatMap((attendeeId) =>
          ["reminder_24", "reminder_3", "followup"].map(async (kind) => {
            const row = await ctx.db
              .query("jobs")
              .withIndex("by_job_id", (q) =>
                q.eq("jobId", `${kind}:${attendeeId}`),
              )
              .unique();
            return row
              ? {
                  jobId: row.jobId,
                  kind: row.kind,
                  attendeeId,
                  dueAt: row.dueAt,
                  status: row.status,
                  attempts: row.attempts,
                  lastError: row.lastError,
                  sentAt: row.sentAt ?? null,
                  scheduledFunctionId: row.scheduledFunctionId ?? null,
                  providerMessageId: row.providerMessageId ?? null,
                }
              : null;
          }),
        ),
      )
    ).filter(Boolean);

    const deliveries = (await ctx.db.query("emailDeliveries").collect()).filter(
      (row) =>
        row.attendeeId === keepAttendeeId ||
        row.attendeeId === cancelAttendeeId,
    );

    const guests = [];
    for (const attendeeId of ids) {
      const row = await ctx.db
        .query("attendees")
        .withIndex("by_attendee_id", (q) => q.eq("attendeeId", attendeeId))
        .unique();
      if (row) guests.push(toAttendee(row));
    }

    return { jobs, deliveries, guests, checkedAt: Date.now() };
  },
});

export const tryPrepareSend = mutation({
  args: {
    internalSecret: v.string(),
    jobId: v.string(),
  },
  handler: async (ctx, { internalSecret, jobId }) => {
    assertInternal(internalSecret);
    assertDevEmailScheduleAllowed();
    const result = await prepareSendHandler(ctx, jobId);
    return {
      claimed: Boolean(result),
      status: result ? "processing_or_ready" : "not_claimed",
    };
  },
});
