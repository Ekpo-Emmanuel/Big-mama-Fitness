import Stripe from "stripe";
import { getEvent } from "./db";
import { type Attendee, type PaymentSnapshot } from "./booking";
import { eventDateFull, eventTime, type DanceEvent } from "./event";
import { PublicError, siteUrl } from "./http";
import { api, convexClient, internalSecret, withConvex } from "./convex";

const CHECKOUT_BRAND = "Big Mama Fitness";

export function checkoutProductDescription(event: DanceEvent) {
  return `${eventDateFull(event)} · ${eventTime(event)} – ${eventTime(event, event.endsAt)} · ${event.city}, ${event.province}`;
}

export function checkoutProductImage(event: DanceEvent, origin = siteUrl()) {
  if (!event.heroImageUrl) return undefined;
  const url = new URL(event.heroImageUrl, origin);
  if (url.protocol !== "https:") return undefined;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    return undefined;
  return url.href;
}

export function checkoutSessionParams(
  event: DanceEvent,
  row: Attendee,
): Stripe.Checkout.SessionCreateParams {
  const image = checkoutProductImage(event);
  return {
    mode: "payment",
    submit_type: "book",
    customer_email: row.email,
    client_reference_id: row.id,
    integration_identifier: "afro_dance_checkout_nanaimob",
    metadata: { attendeeId: row.id, eventId: event.id },
    branding_settings: {
      display_name: CHECKOUT_BRAND,
      background_color: "#fff9ef",
      button_color: "#321b39",
      border_style: "pill",
      font_family: "inter",
    },
    custom_text: {
      submit: {
        message: "Your spot is confirmed after payment succeeds.",
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: row.currency.toLowerCase(),
          unit_amount: event.priceCents,
          product_data: {
            name: event.name,
            description: checkoutProductDescription(event),
            ...(image ? { images: [image] } : {}),
          },
        },
      },
    ],
    expires_at: row.expires_at,
    success_url: `${siteUrl()}/event/${event.slug}/success?token=${row.confirmation_token}`,
    cancel_url: `${siteUrl()}/event/${event.slug}/register?cancelled=1`,
  };
}
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new PublicError(
      "Booking is not open yet. Please check back soon.",
      503,
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 15000,
  });
}
export function snapshot(session: Stripe.Checkout.Session): PaymentSnapshot {
  return {
    id: session.id,
    attendeeId: session.metadata?.attendeeId || "",
    eventId: session.metadata?.eventId || "",
    paymentStatus: session.payment_status,
    status: session.status,
    amount: session.amount_total,
    currency: session.currency,
    paymentIntent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
  };
}
export function checkoutIdempotencyKey(
  row: Pick<Attendee, "request_key" | "expires_at" | "stripe_session_id">,
) {
  // Bind key to hold window + prior session so cancel/retry never reuses the
  // first Stripe idempotency key with different Checkout params (expires_at).
  return `${row.request_key}:${row.expires_at}:${row.stripe_session_id || "new"}`;
}

export async function createCheckout(row: Attendee, client = stripeClient()) {
  if (row.inventory_status === "sold")
    return `${siteUrl()}/event/${(await getEvent(row.event_id))!.slug}/success?token=${row.confirmation_token}`;
  if (Date.now() - Date.parse(row.registered_at) > 23 * 60 * 60 * 1000)
    throw new PublicError(
      "This checkout needs organizer review. Please contact the organizer.",
      409,
    );
  const event = (await getEvent(row.event_id))!;
  const priorSessionId = row.stripe_session_id;
  if (row.checkout_url && priorSessionId) {
    try {
      const existing = await client.checkout.sessions.retrieve(priorSessionId);
      if (existing.status === "open" && existing.url) return existing.url;
    } catch {
      // Fall through and create a fresh session.
    }
  }
  const params = await withConvex(async () => {
    const saved = await convexClient().query(api.booking.getCheckoutRecord, {
      attendeeId: row.id,
    });
    if (saved) {
      const parsed = JSON.parse(saved.params) as Stripe.Checkout.SessionCreateParams;
      const savedAmount = saved.amount;
      if (savedAmount === event.priceCents) {
        // Refresh expiry to match the current hold window.
        return { ...parsed, expires_at: row.expires_at };
      }
      await convexClient().mutation(api.booking.clearCheckoutRecord, {
        attendeeId: row.id,
        internalSecret: internalSecret(),
      });
    }
    const value = checkoutSessionParams(event, row);
    await convexClient().mutation(api.booking.saveCheckoutRecord, {
      attendeeId: row.id,
      amount: event.priceCents,
      params: JSON.stringify(value),
      internalSecret: internalSecret(),
    });
    return value;
  });
  let session: Stripe.Checkout.Session;
  try {
    session = await client.checkout.sessions.create(params, {
      idempotencyKey: checkoutIdempotencyKey({
        ...row,
        // Prior session id in the key even when we are replacing an expired one.
        stripe_session_id: priorSessionId,
      }),
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError)
      throw new PublicError(
        error.message || "Payment checkout could not start. Please try again.",
        502,
      );
    throw error;
  }
  await withConvex(() =>
    convexClient().mutation(api.booking.attachStripeSession, {
      attendeeId: row.id,
      stripeSessionId: session.id,
      checkoutUrl: session.url,
      internalSecret: internalSecret(),
    }),
  );
  if (!session.url)
    throw new PublicError(
      "Checkout has finished. Please check your confirmation.",
      409,
    );
  return session.url;
}
