import { test } from "vitest";
import assert from "node:assert/strict";
import { fixture } from "./harness";
import { initialEvent } from "../lib/event";
import { registration, pay, paidSnapshot } from "./booking-fixtures";
import { processPaymentHandler, reserveHandler } from "../convex/booking";
import { attendeeDoc, toAttendee } from "../convex/map";
import { composeEmail, guestEmailAllowed } from "../lib/email/compose";
import {
  confirmationEmail,
  followupEmail,
  reminder24Email,
  reminderSameDayEmail,
} from "../lib/email/templates";
import { uniqueEmails } from "../lib/email/recipients";
import {
  calendarIcsUrl,
  eventCalendarIcs,
  eventPageUrl,
  googleCalendarUrl,
} from "../lib/email/calendar";
import {
  followupDueAt,
  postPaymentEmailJobs,
  reminderDueTimes,
} from "../lib/email/schedule";
import { assertProductionEmailSafety } from "../lib/email/safety";
import { applyEmailTestRedirect, messagesPerRecipient, recipientSendKey } from "../lib/email/provider";
import {
  prepareSendHandler,
  recordDeliveryHandler,
  retryConfirmationHandler,
  applyResendDeliveryEventHandler,
} from "../convex/jobs";
import {
  mapResendDeliveryStatus,
  parseResendWebhookPayload,
  shouldApplyDeliveryStatus,
  verifyResendWebhook,
} from "../lib/resend-webhook";
import { createHmac } from "node:crypto";
import { updateGuestHandler } from "../convex/guests";

test("paid webhook queues one confirmation and one organizer job", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "mail_pay");
  const jobs = await t.query(async (ctx) => {
    const rows = await ctx.db.query("jobs").collect();
    return rows.map((job) => job.kind).sort();
  });
  assert.deepEqual(
    jobs.filter((kind) => kind === "confirmation" || kind === "organizer"),
    ["confirmation", "organizer"],
  );
  assert.equal(jobs.filter((kind) => kind === "confirmation").length, 1);
});

test("duplicate Stripe receipt does not queue a second confirmation", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "dup_evt");
  await t.mutation((ctx) =>
    processPaymentHandler(
      ctx,
      "dup_evt",
      "checkout.session.completed",
      paidSnapshot(row.id),
    ),
  );
  const count = await t.query(async (ctx) => {
    const rows = await ctx.db.query("jobs").collect();
    return rows.filter((job) => job.kind === "confirmation").length;
  });
  assert.equal(count, 1);
});

test("paid payment stores scheduled function ids for confirmation and reminders", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "sched_ids");
  const jobs = await t.query(async (ctx) => {
    const rows = await ctx.db.query("jobs").collect();
    return rows
      .filter((job) =>
        ["confirmation", "organizer", "reminder_24", "reminder_3", "followup"].includes(
          job.kind,
        ),
      )
      .map((job) => ({
        kind: job.kind,
        scheduled: Boolean(job.scheduledFunctionId),
        dueAt: job.dueAt,
      }));
  });
  const byKind = Object.fromEntries(jobs.map((job) => [job.kind, job]));
  assert.equal(byKind.confirmation.scheduled, true);
  assert.equal(byKind.organizer.scheduled, true);
  assert.equal(byKind.reminder_24.scheduled, true);
  assert.equal(byKind.reminder_3.scheduled, true);
  assert.equal(byKind.followup.scheduled, true);
});

test("duplicate scheduled prepare does not send confirmation twice", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "dup_sched");
  const first = await t.mutation((ctx) =>
    prepareSendHandler(ctx, `confirmation:${row.id}`),
  );
  const second = await t.mutation((ctx) =>
    prepareSendHandler(ctx, `confirmation:${row.id}`),
  );
  assert.ok(first);
  assert.equal(second, null);
});

test("failed payment and abandoned checkout queue no confirmation", async () => {
  const t = await fixture();
  const failed = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await t.mutation((ctx) =>
    processPaymentHandler(
      ctx,
      "fail_evt",
      "checkout.session.async_payment_failed",
      { ...paidSnapshot(failed.id), paymentStatus: "unpaid" },
    ),
  );
  const abandoned = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await t.mutation((ctx) =>
    processPaymentHandler(ctx, "expire_evt", "checkout.session.expired", {
      ...paidSnapshot(abandoned.id),
      paymentStatus: "unpaid",
      status: "expired",
    }),
  );
  const kinds = await t.query(async (ctx) => {
    const rows = await ctx.db.query("jobs").collect();
    return rows.map((job) => job.kind);
  });
  assert.equal(kinds.includes("confirmation"), false);
  assert.equal(kinds.includes("organizer"), false);
});

test("cancelled and refunded guests are not eligible for reminders", async () => {
  const t = await fixture();
  const ids: string[] = [];
  for (const key of ["c", "r"]) {
    const row = await t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, registration()),
    );
    ids.push(row.id);
    await pay(t, row.id, `mail_${key}`);
  }
  await t.mutation((ctx) => updateGuestHandler(ctx, ids[0], "cancel"));
  await t.mutation((ctx) => updateGuestHandler(ctx, ids[1], "record_refund"));
  const people = await t.query(async (ctx) => {
    const eventRow = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    const cancelled = toAttendee((await attendeeDoc(ctx, ids[0]))!);
    const refunded = toAttendee((await attendeeDoc(ctx, ids[1]))!);
    return { event: eventRow, cancelled, refunded };
  });
  const event = {
    ...initialEvent,
    status: people.event!.status,
    startsAt: people.event!.startsAt,
    endsAt: people.event!.endsAt,
  };
  assert.equal(guestEmailAllowed(people.cancelled, event, "reminder_24"), false);
  assert.equal(guestEmailAllowed(people.refunded, event, "reminder_3"), false);
  assert.equal(people.refunded.payment_status, "refunded");
  const reminder = await t.mutation((ctx) =>
    prepareSendHandler(ctx, `reminder_24:${ids[0]}`),
  );
  assert.equal(reminder, null);
  const skipped = await t.query(async (ctx) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", `reminder_24:${ids[0]}`))
      .unique();
    return job?.status;
  });
  assert.equal(skipped, "skipped");
});

test("email failure logging does not change paid attendee status", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "paid_stay");
  await t.mutation((ctx) =>
    recordDeliveryHandler(ctx, {
      jobId: `confirmation:${row.id}`,
      eventId: initialEvent.id,
      attendeeId: row.id,
      type: "confirmation",
      deliveries: [
        { recipient: "guest@example.com", providerMessageId: null },
      ],
      status: "failed",
      errorMessage: "Email provider rejected delivery",
    }),
  );
  const state = await t.query(async (ctx) => {
    const person = await attendeeDoc(ctx, row.id);
    const deliveries = await ctx.db.query("emailDeliveries").collect();
    return {
      payment: person!.paymentStatus,
      attendee: person!.attendeeStatus,
      deliveries: deliveries.length,
      failed: deliveries[0]?.status,
    };
  });
  assert.equal(state.payment, "paid");
  assert.equal(state.attendee, "confirmed");
  assert.equal(state.deliveries, 1);
  assert.equal(state.failed, "failed");
});

test("resend confirmation is allowed only after needs_review", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "retry_pay");
  await assert.rejects(
    () => t.mutation((ctx) => retryConfirmationHandler(ctx, row.id)),
    /already queued/,
  );
  await t.mutation(async (ctx) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) =>
        q.eq("jobId", `confirmation:${row.id}`),
      )
      .unique();
    await ctx.db.patch(job!._id, { status: "needs_review" });
  });
  await t.mutation((ctx) => retryConfirmationHandler(ctx, row.id));
  const jobs = await t.query(async (ctx) => {
    const rows = await ctx.db.query("jobs").collect();
    return rows.filter((job) => job.kind === "confirmation").length;
  });
  assert.equal(jobs, 2);
});

test("confirmation copy includes event facts and calendar; organizers all receive notice", () => {
  const guest = {
    ...toGuest(),
    first_name: "Test",
    last_name: "Guest",
    email: "guest@example.com",
    registered_at: "2026-09-26T12:00:00.000Z",
  };
  const confirmation = composeEmail({
    kind: "confirmation",
    attendee: guest,
    event: initialEvent,
    sold: 4,
    organizerEmails: [],
  })!;
  assert.match(confirmation.subject, /You're in/);
  assert.match(confirmation.text, /Test/);
  assert.match(confirmation.text, /Saturday, October 17, 2026/);
  assert.match(confirmation.text, /1969 Boxwood Rd/);
  assert.match(confirmation.text, /water bottle/);
  assert.match(confirmation.text, /calendar\.google\.com/);
  assert.match(confirmation.html, /max-width:560px/);
  assert.match(confirmation.html, /Google Calendar/);
  assert.match(confirmation.html, /Apple \/ Outlook \(\.ics\)/);
  assert.match(confirmation.html, /calendar\.ics/);
  const layout = confirmationEmail(initialEvent, guest);
  assert.equal(layout.to[0], "guest@example.com");
  const organizer = composeEmail({
    kind: "organizer",
    attendee: guest,
    event: initialEvent,
    sold: 4,
    organizerEmails: ["a@example.com", "b@example.com"],
  })!;
  assert.deepEqual(organizer.to, ["a@example.com", "b@example.com"]);
  assert.match(organizer.subject, /Test Guest/);
  assert.match(organizer.text, /guest@example.com/);
  assert.match(organizer.text, /4 \/ 20/);
  assert.match(organizer.text, /Registered: 26\/09\/2026 at 05:00am/);
  assert.match(organizer.html, /Registered/);
  assert.match(organizer.html, /26\/09\/2026 at 05:00am/);
  assert.match(organizer.html, /Anton/);
  assert.match(organizer.html, /Inter/);
  assert.equal(organizer.text.includes("2505550123"), false);
});

test("calendar links use Pacific wall time and a public ICS file", () => {
  const google = new URL(googleCalendarUrl(initialEvent));
  assert.equal(google.searchParams.get("ctz"), "America/Vancouver");
  assert.equal(
    google.searchParams.get("dates"),
    "20261018T000000Z/20261018T013000Z",
  );
  assert.equal(google.searchParams.get("text"), initialEvent.name);
  assert.match(google.searchParams.get("location") || "", /1969 Boxwood Rd/);
  assert.equal(google.searchParams.get("details")?.includes("@"), false);
  const ics = eventCalendarIcs(initialEvent);
  assert.match(ics, /DTSTART;TZID=America\/Vancouver:20261017T170000/);
  assert.match(ics, /DTEND;TZID=America\/Vancouver:20261017T183000/);
  assert.match(ics, /SUMMARY:Afro Dance Fitness Nanaimo/);
  assert.match(ics, /LOCATION:1969 Boxwood Rd\\, Nanaimo\\, BC V9S 5X9/);
  assert.match(ics, /TZID:America\/Vancouver/);
  assert.match(ics, /COMMENT:With Brenda/);
  assert.match(ics, /METHOD:PUBLISH/);
  assert.equal(ics.includes("BEGIN:VEVENT"), true);
  assert.equal(ics.includes("mailto:"), false);
  assert.equal(ics.includes("guest@"), false);
  const withOrganizer = eventCalendarIcs({
    ...initialEvent,
    contactEmail: "brenda@example.com",
  });
  assert.match(withOrganizer, /ORGANIZER;CN=Brenda:mailto:brenda@example.com/);
  assert.equal(withOrganizer.includes("guest@"), false);
});

test("production site URL drives email and calendar links", () => {
  const previousSite = process.env.SITE_URL;
  const previousApp = process.env.APP_URL;
  process.env.SITE_URL = "https://www.bigmamafit.ca";
  delete process.env.APP_URL;
  try {
    const page = "https://www.bigmamafit.ca/event/afro-dance-fitness";
    assert.equal(eventPageUrl(initialEvent), page);
    assert.equal(calendarIcsUrl(initialEvent), page + "/calendar.ics");
    const google = new URL(googleCalendarUrl(initialEvent));
    const details = google.searchParams.get("details") || "";
    assert.equal(details.includes(page), true);
    assert.equal(details.includes("localhost"), false);
    const ics = eventCalendarIcs(initialEvent);
    assert.match(ics, /PRODID:-\/\/Big Mama Fitness\/\/Calendar\/\/EN/);
    assert.match(
      ics,
      /URL:https:\/\/www\.bigmamafit\.ca\/event\/afro-dance-fitness/,
    );
    assert.equal(ics.includes("localhost"), false);
    const guest = toGuest();
    const confirmation = confirmationEmail(initialEvent, guest);
    assert.match(confirmation.html, /Big Mama Fitness/);
    assert.match(confirmation.html, /calendar\.ics/);
    assert.equal(confirmation.html.includes("localhost"), false);
    assert.equal(confirmation.text.includes("localhost"), false);
    const followup = followupEmail(
      initialEvent,
      { ...guest, marketing_consent: 1, feedback_token: "b".repeat(64) },
      "https://www.bigmamafit.ca/event/afro-dance-fitness/feedback?token=" +
        "b".repeat(64),
      page,
    );
    assert.match(followup.text, /Rate the class/);
    assert.match(
      followup.text,
      /https:\/\/www\.bigmamafit\.ca\/event\/afro-dance-fitness\/feedback\?token=/,
    );
    assert.match(followup.html, /Rate the class/);
    assert.equal(followup.text.includes("Reply to this email"), false);
    assert.match(followup.text, new RegExp(page.replaceAll(".", "\\.")));
    assert.equal(followup.text.includes("localhost"), false);
  } finally {
    if (previousSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSite;
    if (previousApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousApp;
  }
});

test("organizer recipients are unique after case and whitespace normalize", () => {
  const guest = toGuest();
  const organizer = composeEmail({
    kind: "organizer",
    attendee: guest,
    event: { ...initialEvent, contactEmail: "A@example.com" },
    sold: 1,
    organizerEmails: uniqueEmails([
      "A@example.com",
      "a@example.com",
      "  a@example.com  ",
      "b@example.com",
      process.env.ORGANIZER_EMAIL,
    ]),
  })!;
  assert.deepEqual(organizer.to, ["A@example.com", "b@example.com"]);
});

test("Nanaimo timezone offsets drive reminder instants, not server local time", () => {
  const start = "2026-10-17T17:00:00-07:00";
  const end = "2026-10-17T18:30:00-07:00";
  const times = reminderDueTimes(start);
  assert.equal(times.reminder_24, Date.parse("2026-10-16T17:00:00-07:00"));
  assert.equal(times.reminder_3, Date.parse("2026-10-17T14:00:00-07:00"));
  assert.equal(followupDueAt(end), Date.parse("2026-10-17T20:30:00-07:00"));
  const now = Date.parse("2026-10-17T12:00:00-07:00");
  assert.deepEqual(
    postPaymentEmailJobs({ startsAt: start, endsAt: end }, now).map(
      (job) => job.kind,
    ),
    ["organizer", "reminder_3", "followup"],
  );
});

test("late purchase does not queue a past 24h reminder", async () => {
  const t = await fixture();
  const start = Date.now() + 3.5 * 60 * 60 * 1000;
  const end = start + 90 * 60 * 1000;
  const startsAt = new Date(start).toISOString();
  const endsAt = new Date(end).toISOString();
  await t.mutation(async (ctx) => {
    const row = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(row!._id, { startsAt, endsAt });
  });
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "near_now");
  const jobs = await t.query(async (ctx) =>
    (await ctx.db.query("jobs").collect()).map((job) => ({
      kind: job.kind,
      dueAt: job.dueAt,
    })),
  );
  assert.equal(
    jobs.some((job) => job.kind === "reminder_24"),
    false,
  );
  const reminder3 = jobs.find((job) => job.kind === "reminder_3");
  const followup = jobs.find((job) => job.kind === "followup");
  assert.ok(reminder3);
  assert.ok(followup);
  assert.equal(reminder3!.dueAt, Date.parse(startsAt) - 3 * 60 * 60 * 1000);
  assert.equal(followup!.dueAt, Date.parse(endsAt) + 2 * 60 * 60 * 1000);
});

test("cancelled and refunded guests skip reminder and follow-up compose", () => {
  const event = initialEvent;
  assert.equal(
    composeEmail({
      kind: "reminder_24",
      attendee: { ...toGuest(), attendee_status: "cancelled" },
      event,
      sold: 1,
      organizerEmails: [],
    }),
    null,
  );
  assert.equal(
    composeEmail({
      kind: "followup",
      attendee: { ...toGuest(), payment_status: "refunded" },
      event,
      sold: 1,
      organizerEmails: [],
    }),
    null,
  );
});

test("templates stay free of internal ids and include calendar plus location", () => {
  const guest = { ...toGuest(), id: "attendee_secret_id" };
  const confirmation = confirmationEmail(initialEvent, guest);
  const reminder24 = reminder24Email(initialEvent, guest);
  const reminder3 = reminderSameDayEmail(initialEvent, guest);
  const followup = followupEmail(
    initialEvent,
    guest,
    "https://example.test/event/afro-dance-fitness/feedback?token=" +
      "c".repeat(64),
  );
  for (const mail of [confirmation, reminder24, reminder3, followup]) {
    assert.equal(mail.html.includes("attendee_secret_id"), false);
    assert.equal(mail.text.includes("attendee_secret_id"), false);
    assert.match(mail.html, /max-width:560px/);
  }
  assert.match(confirmation.html, /calendar\.google\.com/);
  assert.match(confirmation.text, /Saturday, October 17, 2026/);
  assert.match(confirmation.text, /5:00/);
  assert.match(confirmation.text, /6:30/);
  assert.match(reminder3.text, /1969 Boxwood Rd/);
  assert.match(followup.text, /Rate the class/);
  assert.equal(followup.text.includes("Reply to this email"), false);
  assert.equal(followup.text.includes("See upcoming dates"), false);
});

test("EMAIL_TEST_REDIRECT overrides recipients only when explicitly set", () => {
  const previous = process.env.EMAIL_TEST_REDIRECT;
  const guest = toGuest();
  const confirmation = confirmationEmail(initialEvent, guest);
  const organizer = composeEmail({
    kind: "organizer",
    attendee: guest,
    event: initialEvent,
    sold: 2,
    organizerEmails: ["a@example.com", "b@example.com"],
  })!;

  delete process.env.EMAIL_TEST_REDIRECT;
  assert.deepEqual(applyEmailTestRedirect(confirmation).to, [guest.email]);
  assert.equal(applyEmailTestRedirect(confirmation).subject, confirmation.subject);
  assert.deepEqual(applyEmailTestRedirect(organizer).to, [
    "a@example.com",
    "b@example.com",
  ]);
  assert.equal(applyEmailTestRedirect(organizer).subject, organizer.subject);

  process.env.EMAIL_TEST_REDIRECT = "   ";
  assert.deepEqual(applyEmailTestRedirect(confirmation).to, [guest.email]);

  process.env.EMAIL_TEST_REDIRECT = "tester@example.com";
  const redirectedGuest = applyEmailTestRedirect(confirmation);
  assert.deepEqual(redirectedGuest.to, ["tester@example.com"]);
  assert.match(redirectedGuest.subject, /\[test · guest@example.com\]/);
  const redirectedOrganizer = applyEmailTestRedirect(organizer);
  assert.deepEqual(redirectedOrganizer.to, ["tester@example.com"]);
  assert.match(
    redirectedOrganizer.subject,
    /\[test · a@example.com, b@example.com\]/,
  );

  if (previous === undefined) delete process.env.EMAIL_TEST_REDIRECT;
  else process.env.EMAIL_TEST_REDIRECT = previous;
});

test("unpaid guests do not compose confirmation or organizer mail", () => {
  const unpaid = {
    ...toGuest(),
    payment_status: "pending",
    attendee_status: "pending",
  };
  assert.equal(
    composeEmail({
      kind: "confirmation",
      attendee: unpaid,
      event: initialEvent,
      sold: 0,
      organizerEmails: ["a@example.com"],
    }),
    null,
  );
  assert.equal(
    composeEmail({
      kind: "organizer",
      attendee: unpaid,
      event: initialEvent,
      sold: 0,
      organizerEmails: ["a@example.com"],
    }),
    null,
  );
});

test("production email safety blocks test redirect and Resend onboarding sender", () => {
  const vercel = process.env.VERCEL_ENV;
  const redirect = process.env.EMAIL_TEST_REDIRECT;
  const from = process.env.EMAIL_FROM;
  process.env.VERCEL_ENV = "production";
  process.env.EMAIL_TEST_REDIRECT = "tester@example.com";
  process.env.EMAIL_FROM = "ok@example.com";
  assert.throws(
    () => assertProductionEmailSafety(),
    /EMAIL_TEST_REDIRECT must not be set in production/,
  );
  delete process.env.EMAIL_TEST_REDIRECT;
  process.env.EMAIL_FROM = "Afro <onboarding@resend.dev>";
  assert.throws(
    () => assertProductionEmailSafety(),
    /verified production sender/,
  );
  process.env.EMAIL_FROM = "hello@example.com";
  assert.doesNotThrow(() => assertProductionEmailSafety());
  if (vercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercel;
  if (redirect === undefined) delete process.env.EMAIL_TEST_REDIRECT;
  else process.env.EMAIL_TEST_REDIRECT = redirect;
  if (from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = from;
});

test("organizer compose keeps deduped recipients; send fans out one message each", () => {
  const guest = toGuest();
  const organizer = composeEmail({
    kind: "organizer",
    attendee: guest,
    event: initialEvent,
    sold: 2,
    organizerEmails: uniqueEmails([
      "A@example.com",
      " a@example.com ",
      "b@example.com",
    ]),
  })!;
  assert.deepEqual(organizer.to, ["A@example.com", "b@example.com"]);
  const fanOut = messagesPerRecipient({
    from: "Big Mama Fitness <info@example.com>",
    to: organizer.to,
    subject: organizer.subject,
    text: organizer.text,
    html: organizer.html,
  });
  assert.equal(fanOut.length, 2);
  assert.deepEqual(fanOut[0].to, ["A@example.com"]);
  assert.deepEqual(fanOut[1].to, ["b@example.com"]);
  assert.equal(fanOut[0].subject, organizer.subject);
  assert.equal(fanOut[1].text, organizer.text);
  assert.equal(
    recipientSendKey("organizer:abc", "A@Example.com"),
    "organizer:abc:a@example.com",
  );
});

test("markSent stores one delivery row and provider id per organizer", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "org_fanout_pay");
  await t.mutation(async (ctx) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", `organizer:${row.id}`))
      .unique();
    await ctx.db.patch(job!._id, { status: "processing" });
  });
  await t.mutation((ctx) =>
    // markSent is an internalMutation wrapper — call handler via runMutation shape
    (async () => {
      const job = await ctx.db
        .query("jobs")
        .withIndex("by_job_id", (q) => q.eq("jobId", `organizer:${row.id}`))
        .unique();
      if (!job) throw new Error("missing organizer job");
      await ctx.db.patch(job._id, {
        status: "sent",
        lockedUntil: 0,
        lastError: null,
        sentAt: Date.now(),
        scheduledFunctionId: undefined,
      });
      await recordDeliveryHandler(ctx, {
        jobId: `organizer:${row.id}`,
        eventId: initialEvent.id,
        attendeeId: row.id,
        type: "organizer",
        deliveries: [
          { recipient: "a@example.com", providerMessageId: "re_a" },
          { recipient: "b@example.com", providerMessageId: "re_b" },
        ],
        status: "sent",
        errorMessage: null,
      });
    })(),
  );
  const deliveries = await t.query(async (ctx) => {
    const rows = await ctx.db.query("emailDeliveries").collect();
    return rows
      .filter((item) => item.type === "organizer")
      .sort((a, b) => a.recipient.localeCompare(b.recipient));
  });
  assert.equal(deliveries.length, 2);
  assert.equal(deliveries[0].recipient, "a@example.com");
  assert.equal(deliveries[0].providerMessageId, "re_a");
  assert.equal(deliveries[1].recipient, "b@example.com");
  assert.equal(deliveries[1].providerMessageId, "re_b");
});

test("Resend delivery webhook updates each organizer row by provider message id", async () => {
  const t = await fixture();
  await t.mutation(async (ctx) => {
    await ctx.db.insert("emailDeliveries", {
      deliveryId: "d1",
      jobId: "organizer:1",
      eventId: initialEvent.id,
      attendeeId: "att-1",
      type: "organizer",
      recipient: "a@example.com",
      providerMessageId: "re_a",
      status: "sent",
      sentAt: Date.now(),
      failedAt: null,
      errorMessage: null,
    });
    await ctx.db.insert("emailDeliveries", {
      deliveryId: "d2",
      jobId: "organizer:1",
      eventId: initialEvent.id,
      attendeeId: "att-1",
      type: "organizer",
      recipient: "b@example.com",
      providerMessageId: "re_b",
      status: "sent",
      sentAt: Date.now(),
      failedAt: null,
      errorMessage: null,
    });
  });
  await t.mutation((ctx) =>
    applyResendDeliveryEventHandler(ctx, {
      receiptId: "svix_1",
      providerMessageId: "re_a",
      status: "delivered",
      errorMessage: null,
    }),
  );
  await t.mutation((ctx) =>
    applyResendDeliveryEventHandler(ctx, {
      receiptId: "svix_2",
      providerMessageId: "re_b",
      status: "bounced",
      errorMessage: "mailbox full",
    }),
  );
  const again = await t.mutation((ctx) =>
    applyResendDeliveryEventHandler(ctx, {
      receiptId: "svix_1",
      providerMessageId: "re_a",
      status: "delivered",
      errorMessage: null,
    }),
  );
  assert.equal(again.applied, false);
  const rows = await t.query(async (ctx) => {
    const list = await ctx.db.query("emailDeliveries").collect();
    return Object.fromEntries(
      list.map((row) => [row.providerMessageId, row.status]),
    );
  });
  assert.equal(rows.re_a, "delivered");
  assert.equal(rows.re_b, "bounced");
});

test("Resend webhook helpers map events and verify signatures", () => {
  assert.equal(mapResendDeliveryStatus("email.delivered"), "delivered");
  assert.equal(mapResendDeliveryStatus("email.delivery_delayed"), "delayed");
  assert.equal(shouldApplyDeliveryStatus("sent", "delivered"), true);
  assert.equal(shouldApplyDeliveryStatus("bounced", "delivered"), false);
  const parsed = parseResendWebhookPayload({
    type: "email.bounced",
    data: {
      email_id: "re_x",
      bounce: { message: "hard bounce" },
    },
  });
  assert.deepEqual(parsed, {
    type: "email.bounced",
    emailId: "re_x",
    errorMessage: "hard bounce",
  });
  const body = JSON.stringify({ type: "email.sent", data: { email_id: "re_1" } });
  const id = "msg_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secretBytes = Buffer.from("test-secret-bytes-for-webhook!!");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const signature = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  verifyResendWebhook(
    body,
    { id, timestamp, signature: `v1,${signature}` },
    secret,
  );
  assert.throws(() =>
    verifyResendWebhook(
      body,
      { id, timestamp, signature: "v1,bad" },
      secret,
    ),
  );
});

function toGuest() {
  return {
    id: "a1",
    event_id: initialEvent.id,
    request_key: "k",
    first_name: "Test",
    last_name: "Guest",
    email: "guest@example.com",
    phone: "2505550123",
    waiver_version: "v",
    waiver_text: "w",
    waiver_accepted_at: "",
    marketing_consent: 0,
    marketing_consent_at: null,
    referral_source: "",
    attribution: "{}",
    payment_status: "paid",
    attendee_status: "confirmed",
    inventory_status: "sold",
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    checkout_url: null,
    amount_paid_cents: 1000,
    currency: "CAD",
    expires_at: 0,
    registered_at: "",
    updated_at: "",
    confirmation_token: "",
    feedback_token: "a".repeat(64),
    checked_in_at: null,
    cancelled_at: null,
    refunded_at: null,
    checked_in_by: null,
    cancelled_by: null,
    updated_by: null,
  };
}
