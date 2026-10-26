import { analyticsAttribution, getAttribution } from "./attribution";
import { eventCalendarDate } from "./event";
import { findKnownEvent, trackingEventForPath } from "./known-events";

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/;
const GA_ID_RE = /^G-[A-Z0-9]+$/;

export function isValidGtmId(id: string | undefined): id is string {
  return !!id && GTM_ID_RE.test(id);
}

export function isValidGaMeasurementId(id: string | undefined): id is string {
  return !!id && GA_ID_RE.test(id);
}

export type BrowserEvent =
  | "page_view"
  | "reserve_spot_click"
  | "registration_start"
  | "registration_submit"
  | "checkout_start"
  | "sold_out_view"
  | "future_event_lead_submit"
  | "feedback_page_view"
  | "feedback_submitted";
type Properties = {
  event_id?: string;
  event_date?: string;
  event_name?: string;
  ticket_price?: number;
  currency?: string;
  spots_remaining?: number;
  lead_context?:
    "cant_make_current_date" | "current_event_sold_out" | "registration_closed";
};
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
export function trackEvent(name: BrowserEvent, properties: Properties = {}) {
  if (typeof window === "undefined") return;
  const attribution = getAttribution();
  const event =
    findKnownEvent(properties.event_id) ??
    trackingEventForPath(window.location.pathname);
  const safe = {
    event_id: properties.event_id ?? event?.id,
    event_date: event ? eventCalendarDate(event) : properties.event_date,
    event_name: properties.event_name,
    ticket_price: properties.ticket_price,
    currency: properties.currency,
    spots_remaining: properties.spots_remaining,
    lead_context: properties.lead_context,
    ...analyticsAttribution(attribution),
    page_location: window.location.origin + window.location.pathname,
    page_referrer: "",
    client_id: attribution.client_id,
    session_id: attribution.session_id,
  };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...safe });
  // Direct gtag only when GTM is not the active loader.
  if (
    !isValidGtmId(process.env.NEXT_PUBLIC_GTM_ID) &&
    isValidGaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
  ) {
    window.gtag =
      window.gtag ||
      function (...args: unknown[]) {
        window.dataLayer.push(args);
      };
    window.gtag("event", name, safe);
  }
}
