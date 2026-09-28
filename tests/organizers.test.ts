import { test } from "vitest";
import assert from "node:assert/strict";
import { ConvexError } from "convex/values";
import { fixture } from "./harness";
import { initialEvent } from "../lib/event";
import { api } from "../convex/_generated/api";
import { insertOrganizer } from "../convex/organizers";
import { reserveHandler } from "../convex/booking";
import { pay, registration } from "./booking-fixtures";

async function seedOrganizer(
  t: Awaited<ReturnType<typeof fixture>>,
  authUserId: string,
  email: string,
  isActive = true,
) {
  await t.run(async (ctx) => {
    await insertOrganizer(ctx, {
      authUserId,
      email,
      displayName: email,
    });
    if (!isActive) {
      const row = await ctx.db
        .query("organizers")
        .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
        .unique();
      await ctx.db.patch(row!._id, { isActive: false });
    }
  });
}

function deniedStatus(error: unknown) {
  assert.ok(error instanceof ConvexError);
  const data = error.data as { status?: number };
  return data.status;
}

test("two active organizers share admin data; check-in actor is visible to the other", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a", "a@example.com");
  await seedOrganizer(t, "org-b", "b@example.com");
  const row = await t.mutation((ctx) =>
    reserveHandler(ctx, initialEvent.id, registration()),
  );
  await pay(t, row.id, "evt_org_shared");
  const asA = t.withIdentity({ subject: "org-a" });
  const asB = t.withIdentity({ subject: "org-b" });
  const eventsA = await asA.query(api.events.listAll, {});
  const eventsB = await asB.query(api.events.listAll, {});
  assert.deepEqual(
    eventsA.map((event) => event.id),
    eventsB.map((event) => event.id),
  );
  await asA.mutation(api.guests.update, {
    attendeeId: row.id,
    action: "check_in",
  });
  const guestsB = await asB.query(api.booking.listGuests, {
    eventId: initialEvent.id,
  });
  const guest = guestsB.find((item) => item.id === row.id);
  assert.equal(guest?.attendee_status, "checked_in");
  assert.equal(guest?.checked_in_by, "org-a");
  assert.equal(guest?.updated_by, "org-a");
  const meA = await asA.query(api.organizers.currentOrganizer, {});
  const meB = await asB.query(api.organizers.currentOrganizer, {});
  assert.equal(meA?.email, "a@example.com");
  assert.equal(meB?.email, "b@example.com");
});

test("signed-in non-organizer and disabled organizer cannot use admin functions", async () => {
  const t = await fixture();
  await seedOrganizer(t, "org-a", "a@example.com");
  await seedOrganizer(t, "org-disabled", "off@example.com", false);
  const outsider = t.withIdentity({ subject: "user-x" });
  const disabled = t.withIdentity({ subject: "org-disabled" });
  await assert.rejects(
    () => outsider.query(api.events.listAll, {}),
    (error) => deniedStatus(error) === 403,
  );
  await assert.rejects(
    () => disabled.query(api.booking.listGuests, { eventId: initialEvent.id }),
    (error) => deniedStatus(error) === 403,
  );
  await assert.rejects(
    () => outsider.mutation(api.guests.update, { attendeeId: "x", action: "check_in" }),
    (error) => deniedStatus(error) === 403,
  );
  assert.equal(
    await outsider.query(api.organizers.currentOrganizer, {}),
    null,
  );
  assert.equal(
    await disabled.query(api.organizers.currentOrganizer, {}),
    null,
  );
  await assert.rejects(
    () => t.query(api.events.listAll, {}),
    (error) => deniedStatus(error) === 401,
  );
});
