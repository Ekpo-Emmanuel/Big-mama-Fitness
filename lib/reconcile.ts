import { attendee, processPayment } from "./booking";
import { createCheckout, snapshot, stripeClient } from "./stripe";
import { api, convexClient, internalSecret, withConvex } from "./convex";

export async function reconcileReservations() {
  const client = stripeClient();
  let reconciled = 0;
  let unresolved = 0;
  const ids = await withConvex(() =>
    convexClient().query(api.booking.heldAttendees, {
      internalSecret: internalSecret(),
    }),
  );
  for (const id of ids) {
    try {
      let row = (await attendee(id))!;
      if (!row.stripe_session_id) {
        await createCheckout(row, client);
        row = (await attendee(row.id))!;
      }
      if (!row.stripe_session_id) {
        unresolved++;
        continue;
      }
      const session = await client.checkout.sessions.retrieve(
        row.stripe_session_id,
      );
      if (session.status === "expired" && session.payment_status !== "paid") {
        await processPayment(
          `reconcile:${session.id}:expired`,
          "checkout.session.expired",
          snapshot(session),
        );
        reconciled++;
      }
    } catch {
      unresolved++;
    }
  }
  return { reconciled, unresolved };
}
