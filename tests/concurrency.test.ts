import { test } from "vitest";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./harness";
import { reserveHandler, processPaymentHandler } from "../convex/booking";
import { initialEvent } from "../lib/event";
test(
  "two independent mutations compete for the last seat; only one reserves",
  { timeout: 30000 },
  async () => {
    const t = await fixture();
    const input = () => ({
      firstName: "Test",
      lastName: "Guest",
      email: "test@example.com",
      phone: "2505550123",
      waiverAccepted: true,
      waiverVersion: "test-v1",
      marketingConsent: false,
      requestKey: randomUUID(),
    });
    for (let i = 0; i < 19; i++) {
      const row = await t.mutation((ctx) =>
        reserveHandler(ctx, initialEvent.id, input()),
      );
      await t.mutation(async (ctx) => {
        await ctx.db.insert("checkoutRecords", {
          attendeeId: row.id,
          amount: 1000,
          params: "{}",
        });
        await processPaymentHandler(ctx, "evt_" + i, "checkout.session.completed", {
          id: "cs_" + i,
          attendeeId: row.id,
          eventId: initialEvent.id,
          paymentStatus: "paid",
          status: "complete",
          amount: 1000,
          currency: "cad",
          paymentIntent: "pi_" + i,
        });
      });
    }
    const results = await Promise.allSettled([
      t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input())),
      t.mutation((ctx) => reserveHandler(ctx, initialEvent.id, input())),
    ]);
    const outcomes = results
      .map((result) => (result.status === "fulfilled" ? "reserved" : "blocked"))
      .sort();
    assert.deepEqual(outcomes, ["blocked", "reserved"]);
    const stock = await t.query(async (ctx) => {
      const event = await ctx.db
        .query("events")
        .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
        .unique();
      return { sold: event!.soldCount, held: event!.heldCount };
    });
    assert.deepEqual(stock, { sold: 19, held: 1 });
  },
);
