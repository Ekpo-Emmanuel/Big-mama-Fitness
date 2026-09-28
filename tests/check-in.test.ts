import { test } from "vitest";
import assert from "node:assert/strict";
import { fixture } from "./harness";
import { initialEvent } from "../lib/event";
import { api } from "../convex/_generated/api";
import { insertOrganizer } from "../convex/organizers";
import { reserveHandler } from "../convex/booking";
import { updateGuestHandler } from "../convex/guests";
import { attendeeDoc, toAttendee } from "../convex/map";
import { pay, registration } from "./booking-fixtures";

async function seedOrganizer(
  t: Awaited<ReturnType<typeof fixture>>,
  authUserId: string,
) {
  await t.run(async (ctx) => {
    await insertOrganizer(ctx, {
      authUserId,
      email: `${authUserId}@example.com`,
      displayName: authUserId,
    });
  });
}

async function paidGuest(t: Awaited<ReturnType<typeof fixture>>, email: string) {
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, {
      ...registration(),
      email,
      requestKey: crypto.randomUUID(),
    }),
  );
  await pay(t, row.id, `pay_${email}`);
  return row.id;
}

function checkedCount(guests: { attendee_status: string }[]) {
  return guests.filter((guest) => guest.attendee_status === "checked_in").length;
}

test("paid guest can be checked in and undone without changing payment", async () => {
  const t = await fixture();
  const id = await paidGuest(t, "linda@example.com");
  await t.mutation((ctx) => updateGuestHandler(ctx, id, "check_in", "org-a"));
  const checked = await t.query(async (ctx) =>
    toAttendee((await attendeeDoc(ctx, id))!),
  );
  assert.equal(checked.attendee_status, "checked_in");
  assert.ok(checked.checked_in_at);
  assert.equal(checked.checked_in_by, "org-a");
  assert.equal(checked.payment_status, "paid");

  await t.mutation((ctx) =>
    updateGuestHandler(ctx, id, "undo_check_in", "org-a"),
  );
  const undone = await t.query(async (ctx) =>
    toAttendee((await attendeeDoc(ctx, id))!),
  );
  assert.equal(undone.attendee_status, "confirmed");
  assert.equal(undone.checked_in_at, null);
  assert.equal(undone.checked_in_by, null);
  assert.equal(undone.payment_status, "paid");
});

test("check-in and undo are idempotent", async () => {
  const t = await fixture();
  const id = await paidGuest(t, "idem@example.com");
  await t.mutation((ctx) => updateGuestHandler(ctx, id, "check_in", "org-a"));
  const first = await t.query(async (ctx) =>
    toAttendee((await attendeeDoc(ctx, id))!),
  );
  await t.mutation((ctx) => updateGuestHandler(ctx, id, "check_in", "org-b"));
  const second = await t.query(async (ctx) =>
    toAttendee((await attendeeDoc(ctx, id))!),
  );
  assert.equal(second.attendee_status, "checked_in");
  assert.equal(second.checked_in_at, first.checked_in_at);
  assert.equal(second.checked_in_by, first.checked_in_by);
  assert.equal(second.payment_status, "paid");

  await t.mutation((ctx) =>
    updateGuestHandler(ctx, id, "undo_check_in", "org-a"),
  );
  await t.mutation((ctx) =>
    updateGuestHandler(ctx, id, "undo_check_in", "org-b"),
  );
  const undone = await t.query(async (ctx) =>
    toAttendee((await attendeeDoc(ctx, id))!),
  );
  assert.equal(undone.attendee_status, "confirmed");
  assert.equal(undone.checked_in_at, null);
  assert.equal(undone.payment_status, "paid");
});

test("pending attendee cannot be checked in as a door guest", async () => {
  const t = await fixture();
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await assert.rejects(
    () => t.mutation((ctx) => updateGuestHandler(ctx, row.id, "check_in")),
    /Only paid tickets can be managed here/,
  );
  const guests = await t.query(async (ctx) => {
    // Mimic listGuests filter: exclude pending payment.
    const rows = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", initialEvent.id))
      .collect();
    return rows.map(toAttendee).filter((g) => g.payment_status !== "pending");
  });
  assert.equal(
    guests.find((guest) => guest.id === row.id),
    undefined,
  );
});

test("checked-in counter derives correctly after check-in and undo", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a");
  const a = await paidGuest(t, "a@example.com");
  const b = await paidGuest(t, "b@example.com");
  const asA = t.withIdentity({ subject: "org-a" });

  let guests = await asA.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  assert.equal(checkedCount(guests), 0);

  await asA.mutation(api.guests.update, {
    attendeeId: a,
    action: "check_in",
  });
  guests = await asA.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  assert.equal(checkedCount(guests), 1);
  assert.equal(
    guests.find((guest) => guest.id === a)?.attendee_status,
    "checked_in",
  );

  await asA.mutation(api.guests.update, {
    attendeeId: b,
    action: "check_in",
  });
  guests = await asA.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  assert.equal(checkedCount(guests), 2);

  await asA.mutation(api.guests.update, {
    attendeeId: a,
    action: "undo_check_in",
  });
  guests = await asA.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  assert.equal(checkedCount(guests), 1);
  assert.equal(
    guests.find((guest) => guest.id === a)?.attendee_status,
    "confirmed",
  );
  assert.equal(
    guests.find((guest) => guest.id === b)?.attendee_status,
    "checked_in",
  );
});

test("two organizer clients converge on check-in and undo state", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a");
  await seedOrganizer(t, "org-b");
  const id = await paidGuest(t, "shared@example.com");
  const asA = t.withIdentity({ subject: "org-a" });
  const asB = t.withIdentity({ subject: "org-b" });

  await asA.mutation(api.guests.update, {
    attendeeId: id,
    action: "check_in",
  });
  const guestsB = await asB.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  assert.equal(
    guestsB.find((guest) => guest.id === id)?.attendee_status,
    "checked_in",
  );
  assert.equal(
    guestsB.find((guest) => guest.id === id)?.checked_in_by,
    "org-a",
  );

  // Concurrent second check-in stays safe and does not corrupt payment.
  await asB.mutation(api.guests.update, {
    attendeeId: id,
    action: "check_in",
  });
  const afterDouble = await asA.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  const guest = afterDouble.find((item) => item.id === id);
  assert.equal(guest?.attendee_status, "checked_in");
  assert.equal(guest?.payment_status, "paid");
  assert.equal(guest?.checked_in_by, "org-a");

  await asB.mutation(api.guests.update, {
    attendeeId: id,
    action: "undo_check_in",
  });
  const guestsA = await asA.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  assert.equal(
    guestsA.find((item) => item.id === id)?.attendee_status,
    "confirmed",
  );
  assert.equal(guestsA.find((item) => item.id === id)?.checked_in_at, null);
  assert.equal(guestsA.find((item) => item.id === id)?.payment_status, "paid");
});
