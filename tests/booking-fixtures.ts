import { randomUUID } from "node:crypto";
import { fixture } from "./harness";
import { initialEvent } from "../lib/event";
import { processPaymentHandler } from "../convex/booking";
import type { PaymentSnapshot } from "../lib/booking";

export function registration() {
  return {
    firstName: "Test",
    lastName: "Guest",
    email: "guest@example.com",
    phone: "2505550123",
    waiverAccepted: true,
    waiverVersion: "test-v1",
    marketingConsent: false,
    requestKey: randomUUID(),
    attribution: {
      utm_source: "poster",
      utm_medium: "qr",
      utm_campaign: "october17",
      utm_content: "gym",
    },
  };
}

export function paidSnapshot(id: string): PaymentSnapshot {
  return {
    id: `cs_${id}`,
    attendeeId: id,
    eventId: initialEvent.id,
    paymentStatus: "paid",
    status: "complete",
    amount: 1000,
    currency: "cad",
    paymentIntent: `pi_${id}`,
  };
}

export async function pay(
  t: Awaited<ReturnType<typeof fixture>>,
  attendeeId: string,
  receiptId: string,
) {
  await t.mutation(async (ctx) => {
    await ctx.db.insert("checkoutRecords", {
      attendeeId,
      amount: 1000,
      params: "{}",
    });
    await processPaymentHandler(
      ctx,
      receiptId,
      "checkout.session.completed",
      paidSnapshot(attendeeId),
    );
  });
}
