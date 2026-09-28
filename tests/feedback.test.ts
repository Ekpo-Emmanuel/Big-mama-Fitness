import { test } from "vitest";
import assert from "node:assert/strict";
import { ConvexError } from "convex/values";
import { fixture } from "./harness";
import { initialEvent } from "../lib/event";
import { api } from "../convex/_generated/api";
import { insertOrganizer } from "../convex/organizers";
import { reserveHandler } from "../convex/booking";
import { submitFeedbackHandler } from "../convex/feedback";
import { composeEmail } from "../lib/email/compose";
import { feedbackPageUrl, feedbackExpiresAt } from "../lib/feedback";
import { pay, registration } from "./booking-fixtures";

async function paidGuest(
  t: Awaited<ReturnType<typeof fixture>>,
  email?: string,
) {
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, {
      ...registration(),
      email: email ?? `fb-${crypto.randomUUID()}@example.com`,
      requestKey: crypto.randomUUID(),
    }),
  );
  await pay(t, row.id, `fb_${row.id}`);
  return row;
}

async function seedOrganizer(
  t: Awaited<ReturnType<typeof fixture>>,
  authUserId: string,
  email: string,
) {
  await t.run(async (ctx) => {
    await insertOrganizer(ctx, {
      authUserId,
      email,
      displayName: email,
    });
  });
}

function statusOf(error: unknown) {
  assert.ok(error instanceof ConvexError);
  return (error.data as { status?: number }).status;
}

test("follow-up email uses Rate the class CTA with opaque feedback token URL", async () => {
  const t = await fixture();
  const row = await paidGuest(t);
  const guest = await t.query(async (ctx) => {
    const doc = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", row.id))
      .unique();
    return doc!;
  });
  assert.ok(guest.feedbackToken);
  assert.match(guest.feedbackToken!, /^[a-f0-9]{64}$/);
  const mail = composeEmail({
    kind: "followup",
    attendee: {
      ...row,
      feedback_token: guest.feedbackToken!,
      payment_status: "paid",
      attendee_status: "confirmed",
    },
    event: initialEvent,
    sold: 1,
    organizerEmails: [],
  })!;
  const url = feedbackPageUrl(initialEvent, guest.feedbackToken!);
  assert.match(mail.html, /Rate the class/);
  assert.match(mail.text, /Rate the class/);
  assert.equal(mail.text.includes("Reply to this email"), false);
  assert.equal(mail.html.includes(url), true);
  assert.equal(mail.html.includes(row.id), false);
  assert.equal(mail.text.includes(row.id), false);
});

test("invalid and expired feedback tokens are rejected", async () => {
  const t = await fixture();
  const row = await paidGuest(t);
  const guest = await t.query(async (ctx) => {
    const doc = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", row.id))
      .unique();
    return doc!;
  });
  const eventEndsAt = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return event!.endsAt;
  });
  const bad = await t.query(api.feedback.resolve, {
    slug: initialEvent.slug,
    token: "0".repeat(64),
  });
  assert.equal(bad.status, "invalid");

  const pastExpiry = feedbackExpiresAt(eventEndsAt) + 1;
  const expired = await t.query(api.feedback.resolve, {
    slug: initialEvent.slug,
    token: guest.feedbackToken!,
    now: pastExpiry,
  });
  assert.equal(expired.status, "expired");

  await assert.rejects(
    () =>
      t.mutation((ctx) =>
        submitFeedbackHandler(
          ctx,
          initialEvent.id,
          {
            token: guest.feedbackToken!,
            rating: 5,
            sentiment: "loved",
            enjoyedMost: "",
            improvement: "",
          },
          pastExpiry,
        ),
      ),
    (error) => statusOf(error) === 410,
  );
});

test("rating and optional text save against correct attendee; wrong event rejected", async () => {
  const t = await fixture();
  const a = await paidGuest(t, "a@example.com");
  const b = await paidGuest(t, "b@example.com");
  const tokens = await t.query(async (ctx) => {
    const left = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", a.id))
      .unique();
    const right = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", b.id))
      .unique();
    return { a: left!.feedbackToken!, b: right!.feedbackToken! };
  });

  const ok = await t.query(api.feedback.resolve, {
    slug: initialEvent.slug,
    token: tokens.a,
  });
  assert.equal(ok.status, "ok");
  if (ok.status === "ok") {
    assert.equal(ok.firstName, a.first_name);
    assert.equal(ok.alreadySubmitted, false);
  }

  await t.mutation((ctx) =>
    submitFeedbackHandler(ctx, initialEvent.id, {
      token: tokens.a,
      rating: 4,
      sentiment: "good",
      enjoyedMost: "The music",
      improvement: "More water breaks",
    }),
  );

  const rows = await t.query(async (ctx) =>
    ctx.db
      .query("eventFeedback")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect(),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attendeeId, a.id);
  assert.equal(rows[0].rating, 4);
  assert.equal(rows[0].enjoyedMost, "The music");
  assert.equal(rows[0].improvement, "More water breaks");

  await assert.rejects(
    () =>
      t.mutation((ctx) =>
        submitFeedbackHandler(ctx, "missing-event", {
          token: tokens.a,
          rating: 1,
          sentiment: null,
          enjoyedMost: "",
          improvement: "",
        }),
      ),
    (error) => statusOf(error) === 404,
  );

  // Token B creates own row; cannot change A's record.
  await t.mutation((ctx) =>
    submitFeedbackHandler(ctx, initialEvent.id, {
      token: tokens.b,
      rating: 5,
      sentiment: "loved",
      enjoyedMost: "",
      improvement: "",
    }),
  );
  const after = await t.query(async (ctx) =>
    ctx.db
      .query("eventFeedback")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect(),
  );
  assert.equal(after.length, 2);
  assert.equal(after.find((row) => row.attendeeId === a.id)?.rating, 4);
  assert.equal(after.find((row) => row.attendeeId === b.id)?.rating, 5);
});

test("duplicate submit updates same row; organizers see shared feedback; no email of text", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a", "a@example.com");
  await seedOrganizer(t, "org-b", "b@example.com");
  const row = await paidGuest(t);
  const token = await t.query(async (ctx) => {
    const doc = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", row.id))
      .unique();
    return doc!.feedbackToken!;
  });

  await t.mutation((ctx) =>
    submitFeedbackHandler(ctx, initialEvent.id, {
      token,
      rating: 3,
      sentiment: "okay",
      enjoyedMost: "Warmup",
      improvement: "Volume",
    }),
  );
  const first = await t.mutation((ctx) =>
    submitFeedbackHandler(ctx, initialEvent.id, {
      token,
      rating: 5,
      sentiment: "loved",
      enjoyedMost: "Everything",
      improvement: "Nothing",
    }),
  );
  assert.equal(first.updated, true);

  const stored = await t.query(async (ctx) =>
    ctx.db
      .query("eventFeedback")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", row.id))
      .collect(),
  );
  assert.equal(stored.length, 1);
  assert.equal(stored[0].rating, 5);
  assert.equal(stored[0].enjoyedMost, "Everything");

  const asA = t.withIdentity({ subject: "org-a" });
  const asB = t.withIdentity({ subject: "org-b" });
  const listA = await asA.query(api.feedback.listForEvent, {
    eventId: initialEvent.id,
  });
  const listB = await asB.query(api.feedback.listForEvent, {
    eventId: initialEvent.id,
  });
  assert.equal(listA.count, 1);
  assert.equal(listA.average, 5);
  assert.equal(listA.sentimentCounts.loved, 1);
  assert.deepEqual(listA.items, listB.items);

  const mail = composeEmail({
    kind: "followup",
    attendee: { ...row, feedback_token: token, payment_status: "paid" },
    event: initialEvent,
    sold: 1,
    organizerEmails: ["a@example.com"],
  })!;
  assert.equal(mail.text.includes("Everything"), false);
  assert.equal(mail.html.includes("Everything"), false);
  assert.equal(mail.text.includes("Volume"), false);
});

test("follow-up still schedules 2h after event end", async () => {
  const t = await fixture();
  const row = await paidGuest(t);
  const jobs = await t.query(async (ctx) =>
    (
      await ctx.db
        .query("jobs")
        .withIndex("by_attendee", (q) => q.eq("attendeeId", row.id))
        .collect()
    ).filter((job) => job.kind === "followup"),
  );
  assert.equal(jobs.length, 1);
  const event = await t.query(async (ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique(),
  );
  assert.equal(
    jobs[0].dueAt,
    Date.parse(event!.endsAt) + 2 * 60 * 60 * 1000,
  );
});

test("submit via slug stores canonical eventId; admin list via slug finds it", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a", "a@example.com");
  const row = await paidGuest(t);
  const token = await t.query(async (ctx) => {
    const doc = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", row.id))
      .unique();
    return doc!.feedbackToken!;
  });

  assert.notEqual(initialEvent.slug, initialEvent.id);

  const saved = await t.mutation((ctx) =>
    submitFeedbackHandler(ctx, initialEvent.slug, {
      token,
      rating: 4,
      sentiment: "good",
      enjoyedMost: "Beats",
      improvement: "",
    }),
  );
  assert.equal(saved.eventId, initialEvent.id);

  const stored = await t.query(async (ctx) =>
    ctx.db
      .query("eventFeedback")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect(),
  );
  assert.equal(stored.length, 1);
  assert.equal(stored[0].eventId, initialEvent.id);
  assert.equal(stored[0].attendeeId, row.id);

  // Slug-keyed admin URL must still resolve to the same feedback set.
  const asA = t.withIdentity({ subject: "org-a" });
  const bySlug = await asA.query(api.feedback.listForEvent, {
    eventId: initialEvent.slug,
  });
  const byId = await asA.query(api.feedback.listForEvent, {
    eventId: initialEvent.id,
  });
  assert.equal(bySlug.count, 1);
  assert.equal(bySlug.eventId, initialEvent.id);
  assert.equal(bySlug.items[0].enjoyedMost, "Beats");
  assert.equal(byId.count, 1);
  assert.deepEqual(bySlug.items, byId.items);
});

test("admin list for a different event does not include foreign feedback", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a", "a@example.com");
  const row = await paidGuest(t);
  const token = await t.query(async (ctx) => {
    const doc = await ctx.db
      .query("attendees")
      .withIndex("by_attendee_id", (q) => q.eq("attendeeId", row.id))
      .unique();
    return doc!.feedbackToken!;
  });
  await t.mutation((ctx) =>
    submitFeedbackHandler(ctx, initialEvent.id, {
      token,
      rating: 5,
      sentiment: "loved",
      enjoyedMost: "Mine",
      improvement: "",
    }),
  );

  await t.mutation(async (ctx) => {
    const base = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    assert.ok(base);
    await ctx.db.insert("events", {
      eventId: "other-feedback-event",
      slug: "other-feedback-event",
      name: base.name,
      shortName: base.shortName,
      headline: base.headline,
      subheadline: base.subheadline,
      description: base.description,
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      workoutStartsAt: base.workoutStartsAt,
      workoutEndsAt: base.workoutEndsAt,
      timezone: base.timezone,
      venueName: base.venueName,
      addressLine1: base.addressLine1,
      city: base.city,
      province: base.province,
      postalCode: base.postalCode,
      country: base.country,
      priceCents: base.priceCents,
      currency: base.currency,
      capacity: base.capacity,
      targetAttendance: base.targetAttendance,
      status: base.status,
      isPublished: base.isPublished,
      registrationOpen: false,
      instructorName: base.instructorName,
      instructorBio: base.instructorBio,
      contactEmail: base.contactEmail,
      heroImageUrl: base.heroImageUrl,
      heroVideoUrl: base.heroVideoUrl,
      instructorImageUrl: base.instructorImageUrl,
      waiverVersion: base.waiverVersion,
      waiverText: base.waiverText,
      soldCount: 0,
      heldCount: 0,
      updatedAt: new Date().toISOString(),
    });
  });

  const asA = t.withIdentity({ subject: "org-a" });
  const otherList = await asA.query(api.feedback.listForEvent, {
    eventId: "other-feedback-event",
  });
  assert.equal(otherList.count, 0);
  assert.equal(otherList.items.some((item) => item.enjoyedMost === "Mine"), false);
});

test("invalid token creates no feedback row", async () => {
  const t = await fixture();
  const before = await t.query(async (ctx) =>
    (await ctx.db.query("eventFeedback").collect()).length,
  );
  await assert.rejects(
    () =>
      t.mutation((ctx) =>
        submitFeedbackHandler(ctx, initialEvent.id, {
          token: "f".repeat(64),
          rating: 5,
          sentiment: "loved",
          enjoyedMost: "",
          improvement: "",
        }),
      ),
    (error) => statusOf(error) === 404,
  );
  const after = await t.query(async (ctx) =>
    (await ctx.db.query("eventFeedback").collect()).length,
  );
  assert.equal(after, before);
});
