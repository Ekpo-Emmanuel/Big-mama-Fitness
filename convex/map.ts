import type { DanceEvent } from "../lib/event";
import type { Attendee } from "../lib/booking";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export function toDanceEvent(row: Doc<"events">): DanceEvent {
  return {
    id: row.eventId,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    headline: row.headline,
    subheadline: row.subheadline,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    workoutStartsAt: row.workoutStartsAt,
    workoutEndsAt: row.workoutEndsAt,
    timezone: row.timezone,
    venueName: row.venueName,
    addressLine1: row.addressLine1,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    country: row.country,
    priceCents: row.priceCents,
    currency: row.currency,
    capacity: row.capacity,
    targetAttendance: row.targetAttendance,
    status: row.status,
    isPublished: row.isPublished,
    registrationOpen: row.registrationOpen,
    instructorName: row.instructorName,
    instructorBio: row.instructorBio,
    contactEmail: row.contactEmail,
    heroImageUrl: row.heroImageUrl,
    heroVideoUrl: row.heroVideoUrl,
    instructorImageUrl: row.instructorImageUrl,
    waiverVersion: row.waiverVersion,
    waiverText: row.waiverText,
  };
}

export function fromDanceEvent(
  event: DanceEvent,
  extras?: { soldCount?: number; heldCount?: number; updatedAt?: string },
) {
  return {
    eventId: event.id,
    slug: event.slug,
    name: event.name,
    shortName: event.shortName,
    headline: event.headline,
    subheadline: event.subheadline,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    workoutStartsAt: event.workoutStartsAt,
    workoutEndsAt: event.workoutEndsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    addressLine1: event.addressLine1,
    city: event.city,
    province: event.province,
    postalCode: event.postalCode,
    country: event.country,
    priceCents: event.priceCents,
    currency: event.currency,
    capacity: event.capacity,
    targetAttendance: event.targetAttendance,
    status: event.status,
    isPublished: event.isPublished,
    registrationOpen: event.registrationOpen,
    instructorName: event.instructorName,
    instructorBio: event.instructorBio,
    contactEmail: event.contactEmail,
    heroImageUrl: event.heroImageUrl,
    heroVideoUrl: event.heroVideoUrl,
    instructorImageUrl: event.instructorImageUrl,
    waiverVersion: event.waiverVersion,
    waiverText: event.waiverText,
    soldCount: extras?.soldCount ?? 0,
    heldCount: extras?.heldCount ?? 0,
    updatedAt: extras?.updatedAt ?? new Date().toISOString(),
  };
}

export function toAttendee(row: Doc<"attendees">): Attendee {
  return {
    id: row.attendeeId,
    event_id: row.eventId,
    request_key: row.requestKey,
    first_name: row.firstName,
    last_name: row.lastName,
    email: row.email,
    phone: row.phone,
    waiver_version: row.waiverVersion,
    waiver_text: row.waiverText,
    waiver_accepted_at: row.waiverAcceptedAt,
    marketing_consent: row.marketingConsent ? 1 : 0,
    marketing_consent_at: row.marketingConsentAt,
    referral_source: row.referralSource,
    attribution: row.attribution,
    payment_status: row.paymentStatus,
    attendee_status: row.attendeeStatus,
    inventory_status: row.inventoryStatus,
    stripe_session_id: row.stripeSessionId,
    stripe_payment_intent_id: row.stripePaymentIntentId,
    checkout_url: row.checkoutUrl,
    amount_paid_cents: row.amountPaidCents,
    currency: row.currency,
    expires_at: row.expiresAt,
    registered_at: row.registeredAt,
    updated_at: row.updatedAt,
    confirmation_token: row.confirmationToken,
    feedback_token: row.feedbackToken ?? "",
    checked_in_at: row.checkedInAt,
    cancelled_at: row.cancelledAt,
    refunded_at: row.refundedAt,
    checked_in_by: row.checkedInBy,
    cancelled_by: row.cancelledBy,
    updated_by: row.updatedBy,
  };
}

export async function attendeeDoc(
  ctx: QueryCtx | MutationCtx,
  attendeeId: string,
) {
  return ctx.db
    .query("attendees")
    .withIndex("by_attendee_id", (q) => q.eq("attendeeId", attendeeId))
    .unique();
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function attributionFields(json: string) {
  try {
    const data = JSON.parse(json) as Record<string, string | undefined>;
    return {
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmContent: data.utm_content,
    };
  } catch {
    return {};
  }
}
