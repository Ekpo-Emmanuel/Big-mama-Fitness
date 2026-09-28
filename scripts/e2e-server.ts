import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { initialEvent } from "../lib/event";
process.env.APP_URL = "http://127.0.0.1:3100";
process.env.CRON_SECRET =
  process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32
    ? process.env.CRON_SECRET
    : "e2e-only-cron-secret-at-least-32-characters";
process.env.STRIPE_SECRET_KEY = "rk_test_nonfunctional_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_nonfunctional_fixture";
delete process.env.RESEND_API_KEY;
delete process.env.GA_API_SECRET;
delete process.env.NEXT_PUBLIC_GTM_ID;
delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
if (!process.env.NEXT_PUBLIC_CONVEX_URL)
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required for e2e.");
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const secret = process.env.CRON_SECRET;
await client.mutation(api.events.ensureSeeded, {});
const configured = {
  ...initialEvent,
  waiverVersion: "test-v1",
  waiverText: "Test-only participation waiver.",
  startsAt: "2099-10-17T17:00:00-07:00",
  endsAt: "2099-10-17T18:30:00-07:00",
  workoutStartsAt: "2099-10-17T17:15:00-07:00",
  workoutEndsAt: "2099-10-17T18:15:00-07:00",
};
await client.mutation(api.events.saveConfig, {
  inputJson: JSON.stringify(configured),
  internalSecret: secret,
});
for (const state of ["sold", "cancelled", "completed", "admin"]) {
  const event = {
    ...configured,
    id: "e2e-" + state,
    slug: "e2e-" + state,
    status:
      state === "cancelled"
        ? "cancelled"
        : state === "completed"
          ? "completed"
          : "published",
  };
  await client.mutation(api.events.saveConfig, {
    inputJson: JSON.stringify(event),
    internalSecret: secret,
  });
  const count = state === "sold" ? 20 : state === "admin" ? 1 : 0;
  for (let i = 0; i < count; i++) {
    const row = await client.mutation(api.booking.reserve, {
      eventId: event.id,
      input: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "2505550123",
        waiverAccepted: true,
        waiverVersion: "test-v1",
        marketingConsent: false,
        requestKey: randomUUID(),
      },
    });
    await client.mutation(api.booking.saveCheckoutRecord, {
      attendeeId: row.id,
      amount: 1000,
      params: "{}",
      internalSecret: secret,
    });
    await client.mutation(api.booking.processPayment, {
      receiptId: "e2e_" + row.id,
      type: "checkout.session.completed",
      session: {
        id: "cs_" + row.id,
        attendeeId: row.id,
        eventId: event.id,
        paymentStatus: "paid",
        status: "complete",
        amount: 1000,
        currency: "cad",
        paymentIntent: "pi_" + row.id,
      },
      internalSecret: secret,
    });
  }
}
try {
  await client.mutation(api.auth.createOrganizer, {
    email: "organizer@example.com",
    password: "test-only-password-123",
    setupSecret: secret,
  });
} catch {
  // Already created on a reused Convex deployment.
}
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3100"],
  { stdio: "inherit", env: process.env },
);
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
child.on("exit", (code) => process.exit(code || 0));
