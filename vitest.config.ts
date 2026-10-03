import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: [
      "tests/email.test.ts",
      "tests/admin.test.ts",
      "tests/booking.test.ts",
      "tests/jobs.test.ts",
      "tests/event.test.ts",
      "tests/config.test.ts",
      "tests/concurrency.test.ts",
      "tests/organizers.test.ts",
      "tests/check-in.test.ts",
      "tests/confirmation.test.ts",
      "tests/stripe-checkout.test.ts",
      "tests/event-purchase.test.ts",
      "tests/registration-intent.test.ts",
      "tests/checkout-attempt.test.ts",
      "tests/dev-email-schedule.test.ts",
      "tests/feedback.test.ts",
      "tests/next-class-list.test.ts",
    ],
    environment: "node",
  },
});
