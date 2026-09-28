import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { analyticsAttribution, cleanAttribution } from "../lib/attribution";

export const send = internalAction({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    const measurement = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const secret = process.env.GA_API_SECRET;
    const snapshot = await ctx.runMutation(internal.jobs.purchaseSnapshot, {
      jobId,
    });
    if (!snapshot) {
      await ctx.runMutation(internal.jobs.markSkipped, { jobId });
      return;
    }
    if (!measurement || !secret) {
      await ctx.runMutation(internal.jobs.markSkipped, { jobId });
      return;
    }
    try {
      const attribution = cleanAttribution(JSON.parse(snapshot.attribution));
      const response = await fetch(
        "https://www.google-analytics.com/mp/collect?measurement_id=" +
          encodeURIComponent(measurement) +
          "&api_secret=" +
          encodeURIComponent(secret),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: attribution.client_id || snapshot.attendeeId,
            events: [
              {
                name: "purchase",
                params: {
                  transaction_id: snapshot.paymentIntent,
                  value: snapshot.amount / 100,
                  currency: snapshot.currency,
                  event_id: snapshot.eventId,
                  event_name: snapshot.eventName,
                  session_id:
                    attribution.session_id ||
                    Math.floor(Date.parse(snapshot.registeredAt) / 1000),
                  engagement_time_msec: 1,
                  ...analyticsAttribution(attribution),
                  items: [
                    {
                      item_id: snapshot.eventId,
                      item_name: snapshot.eventName,
                      price: snapshot.amount / 100,
                      quantity: 1,
                    },
                  ],
                },
              },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error("Analytics delivery failed");
      await ctx.runMutation(internal.jobs.markSent, {
        jobId,
        deliveries: [
          {
            recipient: "",
            providerMessageId: snapshot.paymentIntent,
          },
        ],
      });
    } catch (error) {
      await ctx.runMutation(internal.jobs.markFailed, {
        jobId,
        error: error instanceof Error ? error.message : "Delivery failed",
      });
    }
  },
});
