import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { fail } from "./errors";
import { attendeeDoc } from "./map";
import { requireActiveOrganizer } from "./organizers";
import { cancelAttendeeMail } from "./jobs";
import type { MutationCtx } from "./_generated/server";

export async function updateGuestHandler(
  ctx: MutationCtx,
  attendeeId: string,
  action: string,
  actorId?: string,
) {
  const row = await attendeeDoc(ctx, attendeeId);
  if (!row) fail("Guest not found.", 404);
  if (row.inventoryStatus !== "sold")
    fail("Only paid tickets can be managed here.", 409);
  const now = new Date().toISOString();
  const actor = actorId ?? null;
  if (
    action === "check_in" &&
    row.paymentStatus === "paid" &&
    ["confirmed", "no_show"].includes(row.attendeeStatus)
  )
    await ctx.db.patch(row._id, {
      attendeeStatus: "checked_in",
      checkedInAt: now,
      checkedInBy: actor,
      updatedBy: actor,
      updatedAt: now,
    });
  else if (action === "cancel" && row.paymentStatus === "paid")
    await ctx.db.patch(row._id, {
      attendeeStatus: "cancelled",
      cancelledAt: now,
      cancelledBy: actor,
      updatedBy: actor,
      updatedAt: now,
    });
  else if (
    action === "no_show" &&
    row.paymentStatus === "paid" &&
    row.attendeeStatus === "confirmed"
  )
    await ctx.db.patch(row._id, {
      attendeeStatus: "no_show",
      updatedBy: actor,
      updatedAt: now,
    });
  else if (action === "record_refund" && row.paymentStatus === "paid")
    await ctx.db.patch(row._id, {
      paymentStatus: "refunded",
      attendeeStatus: "cancelled",
      refundedAt: now,
      cancelledAt: row.cancelledAt ?? now,
      cancelledBy: row.cancelledBy ?? actor,
      updatedBy: actor,
      updatedAt: now,
    });
  else fail("This status change is not available.", 409);
  if (action === "cancel" || action === "record_refund")
    await cancelAttendeeMail(ctx, attendeeId);
  return row.eventId;
}

export const update = mutation({
  args: { attendeeId: v.string(), action: v.string() },
  handler: async (ctx, { attendeeId, action }) => {
    const organizer = await requireActiveOrganizer(ctx);
    return updateGuestHandler(ctx, attendeeId, action, organizer.authUserId);
  },
});
