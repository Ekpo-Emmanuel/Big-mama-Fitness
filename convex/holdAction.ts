import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const check = internalAction({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    const snapshot = await ctx.runQuery(internal.jobs.holdSnapshot, { jobId });
    if (!snapshot || snapshot.inventoryStatus !== "held") {
      await ctx.runMutation(internal.jobs.markSkipped, { jobId });
      return;
    }
    if (!snapshot.stripeSessionId || !process.env.STRIPE_SECRET_KEY) {
      await ctx.runMutation(internal.jobs.markSkipped, { jobId });
      return;
    }
    try {
      const response = await fetch(
        "https://api.stripe.com/v1/checkout/sessions/" +
          encodeURIComponent(snapshot.stripeSessionId),
        {
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
        },
      );
      if (!response.ok) throw new Error("Stripe session lookup failed");
      const session = (await response.json()) as {
        id: string;
        payment_status: string;
        status: string | null;
        amount_total: number | null;
        currency: string | null;
        payment_intent: string | { id: string } | null;
        metadata?: { attendeeId?: string; eventId?: string };
      };
      if (session.status === "expired" && session.payment_status !== "paid") {
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null;
        await ctx.runMutation(internal.booking.applyExpiredSession, {
          receiptId: `reconcile:${session.id}:expired`,
          session: {
            id: session.id,
            attendeeId: session.metadata?.attendeeId || snapshot.attendeeId,
            eventId: session.metadata?.eventId || "",
            paymentStatus: session.payment_status,
            status: session.status,
            amount: session.amount_total,
            currency: session.currency,
            paymentIntent,
          },
        });
      }
      await ctx.runMutation(internal.jobs.markSkipped, { jobId });
    } catch (error) {
      await ctx.runMutation(internal.jobs.markFailed, {
        jobId,
        error: error instanceof Error ? error.message : "Hold reconcile failed",
      });
    }
  },
});
