import { eventState, money, type DanceEvent } from "./event";

/** Purchase-relevant event fields only. No updatedAt, copy, or media. */
export type PurchaseMaterial = {
  eventId: string;
  name: string;
  priceCents: number;
  currency: string;
  startsAt: string;
  endsAt: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  status: string;
  registrationOpen: boolean;
  waiverVersion: string;
};

export function purchaseMaterial(event: DanceEvent): PurchaseMaterial {
  return {
    eventId: event.id,
    name: event.name,
    priceCents: event.priceCents,
    currency: event.currency,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    addressLine1: event.addressLine1,
    city: event.city,
    province: event.province,
    postalCode: event.postalCode,
    status: event.status,
    registrationOpen: event.registrationOpen,
    waiverVersion: event.waiverVersion,
  };
}

export function purchaseFingerprint(material: PurchaseMaterial) {
  return [
    material.eventId,
    material.name,
    String(material.priceCents),
    material.currency,
    material.startsAt,
    material.endsAt,
    material.addressLine1,
    material.city,
    material.province,
    material.postalCode,
    material.status,
    material.registrationOpen ? "1" : "0",
    material.waiverVersion,
  ].join("|");
}

export function eventPurchaseFingerprint(event: DanceEvent) {
  return purchaseFingerprint(purchaseMaterial(event));
}

export function registrationAvailabilityMessage(
  event: DanceEvent,
  sold: number,
  held: number,
  now = Date.now(),
) {
  const state = eventState(event, sold, now);
  if (state === "sold_out" || sold >= event.capacity)
    return "This class just sold out.";
  if (state === "cancelled")
    return "This event has been cancelled. Registration is closed.";
  if (state === "completed")
    return "This event has finished. Registration is closed.";
  if (state === "closed" || state === "draft")
    return "Registration is no longer available for this event.";
  if (sold + held >= event.capacity)
    return "The remaining spots are being checked out. Please try again shortly.";
  return null;
}

export function purchaseMismatchMessage(
  seen: PurchaseMaterial,
  current: PurchaseMaterial,
) {
  if (seen.waiverVersion !== current.waiverVersion)
    return "The participation waiver was updated. Please review and accept the latest version.";
  if (
    seen.priceCents !== current.priceCents ||
    seen.currency !== current.currency
  ) {
    const from = money({
      priceCents: seen.priceCents,
      currency: seen.currency,
    });
    const to = money({
      priceCents: current.priceCents,
      currency: current.currency,
    });
    return `The ticket price changed from ${from} to ${to}. Please review the updated price before continuing.`;
  }
  if (seen.startsAt !== current.startsAt || seen.endsAt !== current.endsAt)
    return "The event time was updated. Please review the new details before continuing.";
  if (
    seen.addressLine1 !== current.addressLine1 ||
    seen.city !== current.city ||
    seen.province !== current.province ||
    seen.postalCode !== current.postalCode
  )
    return "The event location was updated. Please review the new details before continuing.";
  if (seen.name !== current.name)
    return "The event name was updated. Please review the new details before continuing.";
  if (
    seen.status !== current.status ||
    seen.registrationOpen !== current.registrationOpen
  )
    return "Registration is no longer available for this event.";
  if (seen.eventId !== current.eventId)
    return "This checkout belongs to a different event. Reload the page and start again.";
  return "Event details were updated. Please reload and review before continuing.";
}
