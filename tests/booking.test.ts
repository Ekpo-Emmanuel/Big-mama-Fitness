import { test } from "vitest";
import assert from "node:assert/strict";
import { fixture } from "./harness";
import { initialEvent } from "../lib/event";
import { eventPurchaseFingerprint } from "../lib/event-purchase";
import { reserveHandler, processPaymentHandler } from "../convex/booking";
import { saveLeadHandler } from "../convex/leads";
import { updateGuestHandler } from "../convex/guests";
import { attendeeDoc, toAttendee, toDanceEvent } from "../convex/map";
import { registration, paidSnapshot, pay } from "./booking-fixtures";

async function liveFingerprint(t: Awaited<ReturnType<typeof fixture>>) {
  return t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return eventPurchaseFingerprint(toDanceEvent(event!));
  });
}

async function liveEvent(t: Awaited<ReturnType<typeof fixture>>) {
  return t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return toDanceEvent(event!);
  });
}
test("verified payment confirms once; retry cannot duplicate sale or jobs", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "evt_one");
  await t.mutation((ctx) =>
    processPaymentHandler(
      ctx,
      "evt_one",
      "checkout.session.completed",
      paidSnapshot(row.id),
    ),
  );
  await t.mutation((ctx) =>
    processPaymentHandler(
      ctx,
      "evt_two",
      "checkout.session.completed",
      paidSnapshot(row.id),
    ),
  );
  const stock = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    const jobs = await ctx.db.query("jobs").collect();
    const person = await attendeeDoc(ctx, row.id);
    return {
      sold: event!.soldCount,
      payment: person!.paymentStatus,
      jobs: jobs.length,
    };
  });
  assert.equal(stock.sold, 1);
  assert.equal(stock.payment, "paid");
  assert.equal(stock.jobs, 7);
});
test("abandoned checkout does not count as sold; expiration releases hold", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  const before = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return { sold: event!.soldCount, held: event!.heldCount };
  });
  assert.deepEqual(before, { sold: 0, held: 1 });
  await t.mutation((ctx) =>
    processPaymentHandler(ctx, "expire", "checkout.session.expired", {
      ...paidSnapshot(row.id),
      paymentStatus: "unpaid",
      status: "expired",
    }),
  );
  const after = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return { sold: event!.soldCount, held: event!.heldCount };
  });
  assert.deepEqual(after, { sold: 0, held: 0 });
});
test("waiver is required; marketing consent is optional; attribution persists", async () => {
  const t = await fixture();
  await assert.rejects(() =>
    t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, {
        ...registration(),
        waiverAccepted: false,
      }),
    ),
  );
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  assert.equal(row.marketing_consent, 0);
  assert.equal(JSON.parse(row.attribution).utm_source, "poster");
});
test("20 successful payments fill capacity; ticket 21 is rejected", async () => {
  const t = await fixture();
  for (let i = 0; i < 20; i++) {
    const row = await t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, registration()),
    );
    await pay(t, row.id, `evt_${i}`);
  }
  const sold = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return event!.soldCount;
  });
  assert.equal(sold, 20);
  await assert.rejects(
    () =>
      t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, registration())),
    /sold out|closed|no longer available/,
  );
});
test("final seat hold blocks a competing checkout and failure releases only hold", async () => {
  const t = await fixture();
  for (let i = 0; i < 19; i++)
    await t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, registration()),
    );
  const last = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await assert.rejects(
    () =>
      t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, registration())),
    /being checked out/,
  );
  await t.mutation((ctx) =>
    processPaymentHandler(
      ctx,
      "failed",
      "checkout.session.async_payment_failed",
      { ...paidSnapshot(last.id), paymentStatus: "unpaid" },
    ),
  );
  const state = await t.query(async (ctx) => {
    const person = await attendeeDoc(ctx, last.id);
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return {
      payment: person!.paymentStatus,
      sold: event!.soldCount,
    };
  });
  assert.equal(state.payment, "failed");
  assert.equal(state.sold, 0);
  await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
});
test("duplicate registration does not reserve twice", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  const second = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  assert.equal(second.id, first.id);
  const held = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return event!.heldCount;
  });
  assert.equal(held, 1);
});
test("lead is separate from attendee and preserves all UTM fields", async () => {
  const t = await fixture();
  const input = {
    ...registration(),
    sourceContext: "cant_make_current_date" as const,
  };
  await t.mutation((ctx) => saveLeadHandler(ctx, initialEvent.id, input));
  await t.mutation((ctx) =>
    saveLeadHandler(ctx, initialEvent.id, {
      ...input,
      firstName: "Updated",
      email: input.email.toUpperCase(),
      lastName: "",
      phone: "",
      marketingConsent: true,
      sourceContext: "current_event_sold_out",
    }),
  );
  const counts = await t.query(async (ctx) => {
    const attendees = await ctx.db.query("attendees").collect();
    const leads = await ctx.db.query("futureEventLeads").collect();
    return { attendees: attendees.length, leads, leadCount: leads.length };
  });
  assert.equal(counts.attendees, 0);
  assert.deepEqual(JSON.parse(counts.leads[0]!.attribution), input.attribution);
  assert.equal(counts.leadCount, 1);
  assert.equal(counts.leads[0]!.firstName, "Updated");
  assert.equal(counts.leads[0]!.lastName, input.lastName);
  assert.equal(counts.leads[0]!.phone, input.phone);
  assert.equal(counts.leads[0]!.marketingConsent, true);
  assert.deepEqual(counts.leads[0]!.sourceContexts, [
    "cant_make_current_date",
    "current_event_sold_out",
  ]);
  const inventory = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return {
      capacity: event!.capacity,
      sold: event!.soldCount,
      held: event!.heldCount,
    };
  });
  assert.deepEqual(inventory, {
    capacity: initialEvent.capacity,
    sold: 0,
    held: 0,
  });
});
test("unpaid completion does not confirm and wrong payment amount rolls back", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await t.mutation(async (ctx) => {
    await ctx.db.insert("checkoutRecords", {
      attendeeId: row.id,
      amount: 1000,
      params: "{}",
    });
    await processPaymentHandler(ctx, "pending", "checkout.session.completed", {
      ...paidSnapshot(row.id),
      paymentStatus: "unpaid",
    });
  });
  const pending = await t.query(async (ctx) => {
    const person = await attendeeDoc(ctx, row.id);
    return person!.attendeeStatus;
  });
  assert.equal(pending, "pending");
  await assert.rejects(() =>
    t.mutation((ctx) =>
      processPaymentHandler(ctx, "bad", "checkout.session.completed", {
        ...paidSnapshot(row.id),
        amount: 1,
      }),
    ),
  );
  const sold = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return event!.soldCount;
  });
  assert.equal(sold, 0);
});
test("check-in records time; cancellation and refunds never release sold inventory", async () => {
  const t = await fixture();
  const ids: string[] = [];
  for (let i = 0; i < 20; i++) {
    const row = await t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, registration()),
    );
    ids.push(row.id);
    await pay(t, row.id, `paid_${i}`);
  }
  await t.mutation((ctx) => updateGuestHandler(ctx, ids[0], "check_in"));
  const afterCheck = await t.query(async (ctx) =>
    toAttendee((await attendeeDoc(ctx, ids[0]))!),
  );
  assert.ok(afterCheck.checked_in_at);
  assert.equal(afterCheck.attendee_status, "checked_in");
  await t.mutation((ctx) => updateGuestHandler(ctx, ids[0], "cancel"));
  await t.mutation((ctx) => updateGuestHandler(ctx, ids[1], "record_refund"));
  const end = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    const refunded = await attendeeDoc(ctx, ids[1]);
    return { sold: event!.soldCount, payment: refunded!.paymentStatus };
  });
  assert.equal(end.sold, 20);
  await assert.rejects(
    () =>
      t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, registration())),
    /sold out|closed|no longer available/,
  );
  assert.equal(end.payment, "refunded");
});

test("stripe cancel retry reuses hold without stale-details error", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation(async (ctx) => {
    const row = await attendeeDoc(ctx, first.id);
    await ctx.db.patch(row!._id, {
      stripeSessionId: "cs_test_cancel",
      checkoutUrl: "https://checkout.stripe.com/test",
    });
  });
  const retry = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, {
      ...input,
      firstName: "Retry",
      marketingConsent: true,
      referralSource: "poster",
    }),
  );
  assert.equal(retry.id, first.id);
  assert.equal(retry.first_name, "Retry");
  assert.equal(retry.marketing_consent, 1);
  assert.equal(retry.inventory_status, "held");
  // Cancel-return keeps open Stripe session for reuse.
  assert.equal(retry.stripe_session_id, "cs_test_cancel");
});

test("cancel retry three times still one attendee", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  for (let i = 0; i < 3; i++) {
    await t.mutation(async (ctx) => {
      const row = await attendeeDoc(ctx, first.id);
      await ctx.db.patch(row!._id, {
        stripeSessionId: `cs_test_retry_${i}`,
        checkoutUrl: `https://checkout.stripe.com/test_${i}`,
      });
    });
    const again = await t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, input),
    );
    assert.equal(again.id, first.id);
  }
  const count = await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect();
    return rows.length;
  });
  assert.equal(count, 1);
});

test("same requestKey never inserts a second attendee", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  const second = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  assert.equal(second.id, first.id);
  const count = await t.query(
    async (ctx) =>
      (
        await ctx.db
          .query("attendees")
          .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
          .collect()
      ).length,
  );
  assert.equal(count, 1);
});

test("same email different requestKey stays separate intents", async () => {
  const t = await fixture();
  const a = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  const b = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  assert.notEqual(a.id, b.id);
  assert.equal(a.email, b.email);
});

test("pay after cancel retries confirms the same attendee", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input));
  await pay(t, first.id, "pay_after_cancel");
  const end = await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect();
    const person = await attendeeDoc(ctx, first.id);
    return {
      count: rows.length,
      payment: person!.paymentStatus,
      inventory: person!.inventoryStatus,
    };
  });
  assert.equal(end.count, 1);
  assert.equal(end.payment, "paid");
  assert.equal(end.inventory, "sold");
});

test("duplicate webhook keeps one confirmed attendee", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "dup_wh_1");
  await t.mutation((ctx) =>
    processPaymentHandler(
      ctx,
      "dup_wh_2",
      "checkout.session.completed",
      paidSnapshot(row.id),
    ),
  );
  const end = await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect();
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return { count: rows.length, sold: event!.soldCount };
  });
  assert.equal(end.count, 1);
  assert.equal(end.sold, 1);
});

test("listGuests hides pending checkouts by default", async () => {
  const t = await fixture();
  const pending = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  const paid = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, paid.id, "guest_list_paid");
  const guests = await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect();
    return rows
      .map(toAttendee)
      .filter((row) => row.payment_status !== "pending");
  });
  const incomplete = await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect();
    return rows
      .map(toAttendee)
      .filter((row) => row.payment_status === "pending");
  });
  assert.equal(guests.length, 1);
  assert.equal(guests[0].id, paid.id);
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0].id, pending.id);
});

test("expired hold sold out does not duplicate attendee", async () => {
  const t = await fixture();
  const input = registration();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation((ctx) =>
    processPaymentHandler(ctx, "expire_sold", "checkout.session.expired", {
      ...paidSnapshot(row.id),
      paymentStatus: "unpaid",
      status: "expired",
    }),
  );
  await t.mutation(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(event!._id, {
      status: "sold_out",
      soldCount: event!.capacity,
    });
  });
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input)),
    /sold out/,
  );
  const count = await t.query(
    async (ctx) =>
      (
        await ctx.db
          .query("attendees")
          .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
          .collect()
      ).length,
  );
  assert.equal(count, 1);
});

test("non-material event edits do not block held retry", async () => {
  const t = await fixture();
  const fingerprint = await liveFingerprint(t);
  const input = {
    ...registration(),
    purchaseFingerprint: fingerprint,
  };
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(event!._id, {
      headline: "New headline",
      description: "New description",
      heroImageUrl: "/media/new.jpg",
      updatedAt: new Date().toISOString(),
    });
  });
  const retry = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  assert.equal(retry.id, first.id);
});

test("price change during held checkout requires review", async () => {
  const t = await fixture();
  const fingerprint = await liveFingerprint(t);
  const input = {
    ...registration(),
    purchaseFingerprint: fingerprint,
  };
  await t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input));
  await t.mutation(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(event!._id, { priceCents: 1200 });
  });
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input)),
    /ticket price changed/,
  );
});

test("event time change during held checkout requires review", async () => {
  const t = await fixture();
  const fingerprint = await liveFingerprint(t);
  const input = {
    ...registration(),
    purchaseFingerprint: fingerprint,
  };
  await t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input));
  await t.mutation(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(event!._id, {
      startsAt: "2099-10-17T18:00:00-07:00",
      endsAt: "2099-10-17T19:30:00-07:00",
    });
  });
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input)),
    /event time was updated/,
  );
});

test("sold out while held returns a specific message", async () => {
  const t = await fixture();
  const heldInput = registration();
  await t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, heldInput));
  for (let i = 0; i < 19; i++) {
    const row = await t.mutation((ctx) =>
      reserveHandler(ctx, initialEvent.id, registration()),
    );
    await pay(t, row.id, `fill_${i}`);
  }
  await t.mutation(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(event!._id, { status: "sold_out" });
  });
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, heldInput)),
    /sold out/,
  );
});

test("waiver version change requires reacceptance", async () => {
  const t = await fixture();
  const before = await liveEvent(t);
  const input = {
    ...registration(),
    purchaseFingerprint: eventPurchaseFingerprint(before),
  };
  await t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input));
  await t.mutation(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    await ctx.db.patch(event!._id, { waiverVersion: "v2" });
  });
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input)),
    /waiver was updated/,
  );
  const after = await liveEvent(t);
  const again = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, {
      ...input,
      waiverVersion: "v2",
      purchaseFingerprint: eventPurchaseFingerprint(after),
    }),
  );
  assert.equal(again.inventory_status, "held");
});

test("same material values after reload still allow retry", async () => {
  const t = await fixture();
  const fingerprint = await liveFingerprint(t);
  const input = { ...registration(), purchaseFingerprint: fingerprint };
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  const second = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, {
      ...input,
      purchaseFingerprint: fingerprint,
    }),
  );
  assert.equal(second.id, first.id);
});
test("released hold can be recreated when capacity remains", async () => {
  const t = await fixture();
  const input = registration();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation((ctx) =>
    processPaymentHandler(ctx, "expire_retry", "checkout.session.expired", {
      ...paidSnapshot(row.id),
      paymentStatus: "unpaid",
      status: "expired",
    }),
  );
  const again = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  assert.equal(again.id, row.id);
  assert.equal(again.inventory_status, "held");
  const held = await t.query(async (ctx) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
      .unique();
    return event!.heldCount;
  });
  assert.equal(held, 1);
});

test("email change on retry clears Stripe session for a fresh Checkout", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation(async (ctx) => {
    const row = await attendeeDoc(ctx, first.id);
    await ctx.db.patch(row!._id, {
      stripeSessionId: "cs_test_old_email",
      checkoutUrl: "https://checkout.stripe.com/old",
    });
  });
  const retry = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, {
      ...input,
      email: "new-address@example.com",
    }),
  );
  assert.equal(retry.id, first.id);
  assert.equal(retry.email, "new-address@example.com");
  assert.equal(retry.stripe_session_id, null);
});

test("slug event key matches canonical event id on retry", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  const second = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.slug, input),
  );
  assert.equal(second.id, first.id);
});

test("paid requestKey cannot start another checkout", async () => {
  const t = await fixture();
  const input = registration();
  const paid = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await pay(t, paid.id, "paid_intent_reuse");
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input)),
    /already complete/,
  );
  const row = await t.query(async (ctx) => attendeeDoc(ctx, paid.id));
  assert.equal(row!.inventoryStatus, "sold");
  assert.equal(row!.paymentStatus, "paid");
});

test("new requestKey after paid creates a second pending attendee", async () => {
  const t = await fixture();
  const firstInput = registration();
  const paid = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, firstInput),
  );
  await pay(t, paid.id, "second_reg_pay");
  const secondInput = registration();
  const next = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, secondInput),
  );
  assert.notEqual(next.id, paid.id);
  assert.equal(next.inventory_status, "held");
  assert.equal(next.payment_status, "pending");
  const count = await t.query(
    async (ctx) =>
      (
        await ctx.db
          .query("attendees")
          .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
          .collect()
      ).length,
  );
  assert.equal(count, 2);
});

test("same email after paid still needs a new requestKey", async () => {
  const t = await fixture();
  const first = registration();
  const paid = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, first),
  );
  await pay(t, paid.id, "same_email_pay");
  const second = {
    ...registration(),
    email: first.email,
    firstName: first.firstName,
    lastName: first.lastName,
  };
  const next = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, second),
  );
  assert.notEqual(next.id, paid.id);
  assert.equal(next.email, paid.email);
  assert.equal(next.payment_status, "pending");
});

test("paid attendee cannot return to pending or held", async () => {
  const t = await fixture();
  const input = registration();
  const paid = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await pay(t, paid.id, "no_unpay");
  await assert.rejects(
    () => t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input)),
    /already complete/,
  );
  const row = await t.query(async (ctx) => attendeeDoc(ctx, paid.id));
  assert.equal(row!.inventoryStatus, "sold");
  assert.equal(row!.paymentStatus, "paid");
  assert.equal(row!.attendeeStatus, "confirmed");
});

test("unpaid cancel retry still reuses ACTIVE requestKey", async () => {
  const t = await fixture();
  const input = registration();
  const first = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  await t.mutation(async (ctx) => {
    const row = await attendeeDoc(ctx, first.id);
    await ctx.db.patch(row!._id, {
      stripeSessionId: "cs_still_active",
      checkoutUrl: "https://checkout.stripe.com/active",
    });
  });
  const retry = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, input),
  );
  assert.equal(retry.id, first.id);
  assert.equal(retry.inventory_status, "held");
  assert.equal(retry.payment_status, "pending");
});
