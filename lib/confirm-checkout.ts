import { processPayment, type ConfirmationRow } from "./booking";
import { snapshot, stripeClient } from "./stripe";

export async function confirmPaidCheckout(row: ConfirmationRow) {
  if (row.payment_status === "paid" || !row.stripe_session_id) return row;
  const session = await stripeClient().checkout.sessions.retrieve(
    row.stripe_session_id,
  );
  if (session.payment_status !== "paid") return row;
  const snap = snapshot(session);
  if (!snap.attendeeId) snap.attendeeId = session.client_reference_id || "";
  if (!snap.eventId) snap.eventId = row.event_id;
  await processPayment(
    `success:${session.id}`,
    "checkout.session.completed",
    snap,
  );
  return {
    ...row,
    payment_status: "paid",
    attendee_status: "confirmed",
  };
}
