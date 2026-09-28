import type { Metadata } from "next";
import { type DanceEvent, eventState } from "./event";
import { siteUrl } from "./http";
export function eventMetadata(event: DanceEvent): Metadata {
  const url = siteUrl() + "/event/" + event.slug;
  return {
    title: event.name,
    description: event.subheadline,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: event.name,
      description: event.subheadline,
      url,
      locale: "en_CA",
      images: [url + "/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description: event.subheadline,
      images: [url + "/opengraph-image"],
    },
  };
}
export function eventSchema(event: DanceEvent, sold: number) {
  const state = eventState(event, sold);
  const url = siteUrl() + "/event/" + event.slug;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus:
      "https://schema.org/" +
      (state === "cancelled" ? "EventCancelled" : "EventScheduled"),
    url,
    location: {
      "@type": "Place",
      name: event.venueName || event.addressLine1,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.addressLine1,
        addressLocality: event.city,
        addressRegion: event.province,
        postalCode: event.postalCode,
        addressCountry: event.country,
      },
    },
    organizer: { "@type": "Person", name: event.instructorName },
    ...(event.heroImageUrl
      ? { image: [new URL(event.heroImageUrl, siteUrl()).href] }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      price: event.priceCents / 100,
      priceCurrency: event.currency,
      availability:
        "https://schema.org/" +
        (state === "open"
          ? "InStock"
          : state === "sold_out"
            ? "SoldOut"
            : state === "cancelled" || state === "completed"
              ? "Discontinued"
              : "OutOfStock"),
    },
  };
}
export function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
