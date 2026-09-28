import type { Attendee } from "./booking";
import type { AdminGuest } from "@/components/admin-guests";

// Only organizer-facing fields cross the client component boundary.
export function adminGuest(row: Attendee): AdminGuest {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    payment_status: row.payment_status,
    attendee_status: row.attendee_status,
    inventory_status: row.inventory_status,
    waiver_version: row.waiver_version,
    waiver_text: row.waiver_text,
    waiver_accepted_at: row.waiver_accepted_at,
    marketing_consent: row.marketing_consent,
    marketing_consent_at: row.marketing_consent_at,
    attribution: row.attribution,
    referral_source: row.referral_source,
    registered_at: row.registered_at,
    checked_in_at: row.checked_in_at,
    amount_paid_cents: row.amount_paid_cents,
    currency: row.currency,
    updated_at: row.updated_at,
  };
}
