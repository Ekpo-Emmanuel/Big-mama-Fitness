import type { Metadata } from "next";
import { type DanceEvent, eventState } from "./event";
import { siteUrl } from "./http";
import {
  shareEventDescription,
  shareEventTitle,
  shareSiteDescription,
  shareSiteTitle,
} from "./og";

const SITE_NAME = "Big Mama Fitness";

export function socialImage(path = "/opengraph-image") {
  const url = new URL(path, siteUrl()).href;
  return {
    url,
    width: 1200,
    height: 630,
    alt: "Afro Dance Fitness Nanaimo — Big Mama Fitness",
    type: "image/png",
  };
}

export function siteShareMetadata(event: DanceEvent): Metadata {
  const url = siteUrl() + "/";
  const title = shareSiteTitle(event);
  const description = shareSiteDescription(event);
  // Image tags come from app/opengraph-image.tsx + app/twitter-image.tsx
  // (avoid duplicate og:image / twitter:image entries).
  return {
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function eventMetadata(event: DanceEvent): Metadata {
  const url = siteUrl() + "/event/" + event.slug;
  const title = shareEventTitle(event);
  const description = shareEventDescription(event);
  // Image tags come from app/event/[slug]/opengraph-image.tsx + twitter-image.tsx
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
    image: [new URL(`/event/${event.slug}/opengraph-image`, siteUrl()).href],
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
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl(),
    },
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
