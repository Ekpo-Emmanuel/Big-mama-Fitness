import { initialEvent } from "../../lib/event";
import type { Attendee } from "../../lib/booking";
export const event = {
  ...initialEvent,
  id: "preview",
  shortName: "Afro Dance Fitness",
  contactEmail: "hello@example.test",
};
const base: Attendee = {
  id: "guest-1",
  event_id: "preview",
  request_key: "never-send-this",
  first_name: "Alexandria-Chioma",
  last_name: "Okafor-MacAllister",
  email: "alexandria.chioma.okafor.macallister@example.test",
  phone: "2505550199",
  payment_status: "paid",
  attendee_status: "confirmed",
  inventory_status: "sold",
  waiver_version: event.waiverVersion,
  waiver_text: event.waiverText,
  waiver_accepted_at: "2026-09-25T12:00:00Z",
  marketing_consent: 1,
  marketing_consent_at: "2026-09-25T12:00:00Z",
  referral_source: "A friend",
  attribution: "instagram",
  registered_at: "2026-09-25T12:00:00Z",
  checked_in_at: null,
  amount_paid_cents: 1000,
  currency: "CAD",
  updated_at: "2026-09-25T12:00:00Z",
  stripe_session_id: null,
  stripe_payment_intent_id: null,
  checkout_url: null,
  expires_at: 0,
  confirmation_token: "never-send-confirmation",
  feedback_token: "never-send-feedback",
  cancelled_at: null,
  refunded_at: null,
  checked_in_by: null,
  cancelled_by: null,
  updated_by: null,
};
export const rows = [
  base,
  {
    ...base,
    id: "guest-2",
    first_name: "Marisol",
    last_name: "Reyes",
    email: "marisol@example.test",
    attendee_status: "checked_in",
    checked_in_at: "2026-10-18T00:00:00Z",
  },
  {
    ...base,
    id: "guest-3",
    first_name: "Nadia",
    last_name: "Chen",
    email: "nadia@example.test",
    attendee_status: "cancelled",
    payment_status: "refunded",
  },
];
export const pending = [
  {
    ...base,
    id: "pending-1",
    first_name: "Amara",
    last_name: "Mensah",
    payment_status: "pending",
    attendee_status: "pending",
    inventory_status: "released",
    amount_paid_cents: 0,
  },
];
export const api = {
  events: { listAll: "list", overview: "overview", ensureSeeded: "seed" },
  booking: { listGuests: "guests", listPendingCheckouts: "pending" },
  feedback: { listForEvent: "feedback" },
  leads: { list: "leads" },
  jobs: { confirmationByEvent: "confirmation" },
};
export async function requireAdmin() {}
export async function fetchAuthMutation() {}
export async function getEvent() {
  return event;
}
// These isolated fixtures cover heterogeneous server query responses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAuthQuery(key: string): Promise<any> {
  const empty = new URLSearchParams(location.search).has("empty");
  if (key === "list") return empty ? [] : [event];
  if (key === "guests") return empty ? [] : rows;
  if (key === "pending") return empty ? [] : pending;
  if (key === "confirmation")
    return { "guest-1": { status: "needs_review", lastError: "Test error" } };
  if (key === "overview")
    return {
      event,
      sold: 3,
      held: 1,
      expected: 2,
      checked: 1,
      absent: 0,
      cancelled: 1,
      gross: 3000,
      net: 2000,
      leads: 2,
      jobs: 4,
    };
  if (key === "feedback")
    return {
      count: empty ? 0 : 2,
      average: empty ? null : 4.5,
      eligible: 3,
      responseRate: empty ? 0 : 66.7,
      sentimentCounts: {
        loved: empty ? 0 : 1,
        good: empty ? 0 : 1,
        okay: 0,
        not_for_me: 0,
      },
      items: empty
        ? []
        : [
            {
              id: "feedback-1",
              firstName: base.first_name,
              lastName: base.last_name,
              rating: 5,
              sentiment: "loved",
              enjoyedMost:
                "The music and welcoming energy. I felt comfortable joining even as a beginner.",
              improvement: "A little more room between dancers would help.",
              submittedAt: base.registered_at,
              updatedAt: base.registered_at,
            },
          ],
    };
  if (key === "leads")
    return empty
      ? []
      : [
          {
            ...base,
            created_at: base.registered_at,
            source_contexts: ["cant_make_current_date"],
          },
          {
            ...base,
            id: "lead-2",
            first_name: "Sofia",
            last_name: "Park",
            email: "sofia@example.test",
            marketing_consent: 0,
            source_contexts: ["current_event_sold_out"],
          },
        ];
}
export const authClient = {
  signOut: async () => {},
  signIn: { email: async () => ({ error: true }) },
};
