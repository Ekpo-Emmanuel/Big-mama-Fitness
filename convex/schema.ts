import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const eventStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("sold_out"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const paymentStatus = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("refunded"),
  v.literal("cancelled"),
);

export const attendeeStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("checked_in"),
  v.literal("no_show"),
);

export const inventoryStatus = v.union(
  v.literal("held"),
  v.literal("sold"),
  v.literal("released"),
);

export const eventFields = {
  eventId: v.string(),
  slug: v.string(),
  name: v.string(),
  shortName: v.string(),
  headline: v.string(),
  subheadline: v.string(),
  description: v.string(),
  startsAt: v.string(),
  endsAt: v.string(),
  workoutStartsAt: v.string(),
  workoutEndsAt: v.string(),
  timezone: v.string(),
  venueName: v.string(),
  addressLine1: v.string(),
  city: v.string(),
  province: v.string(),
  postalCode: v.string(),
  country: v.string(),
  priceCents: v.number(),
  currency: v.string(),
  capacity: v.number(),
  targetAttendance: v.number(),
  status: eventStatus,
  isPublished: v.boolean(),
  registrationOpen: v.boolean(),
  instructorName: v.string(),
  instructorBio: v.string(),
  contactEmail: v.string(),
  heroImageUrl: v.string(),
  heroVideoUrl: v.string(),
  instructorImageUrl: v.string(),
  waiverVersion: v.string(),
  waiverText: v.string(),
  soldCount: v.number(),
  heldCount: v.number(),
  updatedAt: v.string(),
};

export default defineSchema({
  events: defineTable(eventFields)
    .index("by_event_id", ["eventId"])
    .index("by_slug", ["slug"]),
  attendees: defineTable({
    attendeeId: v.string(),
    eventId: v.string(),
    requestKey: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    waiverVersion: v.string(),
    waiverText: v.string(),
    waiverAcceptedAt: v.string(),
    marketingConsent: v.boolean(),
    marketingConsentAt: v.union(v.string(), v.null()),
    referralSource: v.string(),
    attribution: v.string(),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    paymentStatus,
    attendeeStatus,
    inventoryStatus,
    stripeSessionId: v.union(v.string(), v.null()),
    stripePaymentIntentId: v.union(v.string(), v.null()),
    checkoutUrl: v.union(v.string(), v.null()),
    amountPaidCents: v.number(),
    currency: v.string(),
    expiresAt: v.number(),
    registeredAt: v.string(),
    cancelledAt: v.union(v.string(), v.null()),
    refundedAt: v.union(v.string(), v.null()),
    checkedInAt: v.union(v.string(), v.null()),
    checkedInBy: v.union(v.string(), v.null()),
    cancelledBy: v.union(v.string(), v.null()),
    updatedBy: v.union(v.string(), v.null()),
    updatedAt: v.string(),
    confirmationToken: v.string(),
    /** Opaque feedback link token. Generated at reserve; never guessable. */
    feedbackToken: v.optional(v.string()),
    /** Stable hash of purchase-relevant event fields at reserve time. */
    purchaseFingerprint: v.optional(v.string()),
  })
    .index("by_attendee_id", ["attendeeId"])
    .index("by_request_key", ["requestKey"])
    .index("by_event", ["eventId"])
    .index("by_confirmation_token", ["confirmationToken"])
    .index("by_feedback_token", ["feedbackToken"])
    .index("by_stripe_session", ["stripeSessionId"])
    .index("by_inventory", ["eventId", "inventoryStatus"]),
  eventFeedback: defineTable({
    feedbackId: v.string(),
    eventId: v.string(),
    attendeeId: v.string(),
    rating: v.number(),
    sentiment: v.union(
      v.literal("loved"),
      v.literal("good"),
      v.literal("okay"),
      v.literal("not_for_me"),
      v.null(),
    ),
    enjoyedMost: v.string(),
    improvement: v.string(),
    submittedAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_feedback_id", ["feedbackId"])
    .index("by_event", ["eventId"])
    .index("by_attendee", ["attendeeId"])
    .index("by_event_attendee", ["eventId", "attendeeId"]),
  futureEventLeads: defineTable({
    leadId: v.string(),
    sourceEventId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    marketingConsent: v.boolean(),
    marketingConsentAt: v.union(v.string(), v.null()),
    attribution: v.string(),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_lead_id", ["leadId"])
    .index("by_source_event", ["sourceEventId"])
    .index("by_source_email", ["sourceEventId", "email"]),
  checkoutRecords: defineTable({
    attendeeId: v.string(),
    amount: v.number(),
    params: v.string(),
  }).index("by_attendee", ["attendeeId"]),
  webhookReceipts: defineTable({
    receiptId: v.string(),
  }).index("by_receipt", ["receiptId"]),
  jobs: defineTable({
    jobId: v.string(),
    kind: v.string(),
    attendeeId: v.union(v.string(), v.null()),
    payload: v.string(),
    dueAt: v.number(),
    status: v.string(),
    attempts: v.number(),
    lockedUntil: v.number(),
    lastError: v.union(v.string(), v.null()),
    providerMessageId: v.optional(v.union(v.string(), v.null())),
    sentAt: v.optional(v.union(v.number(), v.null())),
    recipient: v.optional(v.union(v.string(), v.null())),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    firstAttemptAt: v.optional(v.number()),
  })
    .index("by_job_id", ["jobId"])
    .index("by_kind_due", ["kind", "dueAt"])
    .index("by_attendee", ["attendeeId"]),
  emailDeliveries: defineTable({
    deliveryId: v.string(),
    jobId: v.string(),
    eventId: v.string(),
    attendeeId: v.union(v.string(), v.null()),
    type: v.string(),
    recipient: v.string(),
    providerMessageId: v.union(v.string(), v.null()),
    status: v.string(),
    sentAt: v.union(v.number(), v.null()),
    failedAt: v.union(v.number(), v.null()),
    errorMessage: v.union(v.string(), v.null()),
  })
    .index("by_job", ["jobId"])
    .index("by_attendee_type", ["attendeeId", "type"])
    .index("by_provider_message_id", ["providerMessageId"]),
  rateLimits: defineTable({
    key: v.string(),
    hits: v.number(),
    resetAt: v.number(),
  }).index("by_key", ["key"]),
  organizers: defineTable({
    authUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_email", ["email"]),
});
