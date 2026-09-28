import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  messagesPerRecipient,
  recipientSendKey,
  sendViaResend,
} from "../lib/email/provider";

export const send = internalAction({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    const prepared = await ctx.runMutation(internal.jobs.prepareSend, { jobId });
    if (!prepared) return;
    if (!prepared.message) {
      await ctx.runMutation(internal.jobs.markSkipped, { jobId });
      return;
    }
    try {
      const deliveries: {
        recipient: string;
        providerMessageId: string | null;
      }[] = [];
      for (const message of messagesPerRecipient(prepared.message)) {
        const recipient = message.to[0];
        const sent = await sendViaResend(
          message,
          recipientSendKey(jobId, recipient),
        );
        deliveries.push({
          recipient,
          providerMessageId: sent.id,
        });
      }
      await ctx.runMutation(internal.jobs.markSent, {
        jobId,
        deliveries,
      });
    } catch (error) {
      await ctx.runMutation(internal.jobs.markFailed, {
        jobId,
        error: error instanceof Error ? error.message : "Delivery failed",
      });
    }
  },
});
