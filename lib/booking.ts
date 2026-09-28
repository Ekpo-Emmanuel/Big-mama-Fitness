import { api, convexClient, internalSecret, withConvex } from "./convex";

export interface Attendee {
  id: string;
  event_id: string;
  request_key: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  waiver_version: string;
  waiver_text: string;
  waiver_accepted_at: string;
  marketing_consent: number;
  marketing_consent_at: string | null;
  referral_source: string;
  attribution: string;
  payment_status: string;
  attendee_status: string;
  inventory_status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  checkout_url: string | null;
  amount_paid_cents: number;
  currency: string;
  expires_at: number;
  registered_at: string;
  updated_at: string;
  confirmation_token: string;
  feedback_token: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  checked_in_by: string | null;
  cancelled_by: string | null;
  updated_by: string | null;
}
export interface PaymentSnapshot {
  id: string;
  attendeeId: string;
  eventId: string;
  paymentStatus: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  paymentIntent: string | null;
}
export async function attendee(id: string) {
  return withConvex(() =>
    convexClient().query(api.booking.getAttendee, {
      attendeeId: id,
      internalSecret: internalSecret(),
    }),
  );
}
export async function reserve(eventId: string, input: unknown) {
  return withConvex(() =>
    convexClient().mutation(api.booking.reserve, { eventId, input }),
  );
}
export async function processPayment(
  receiptId: string,
  type: string,
  session: PaymentSnapshot,
) {
  return withConvex(() =>
    convexClient().mutation(api.booking.processPayment, {
      receiptId,
      type,
      session,
      internalSecret: internalSecret(),
    }),
  );
}
