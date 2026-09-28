import { stripeClient, snapshot } from "@/lib/stripe";
import { processPayment } from "@/lib/booking";
import type Stripe from "stripe";
import { readText } from "@/lib/http";
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY)
    return new Response("Webhook not configured", { status: 503 });
  const client = stripeClient();
  let event: Stripe.Event;
  try {
    const raw = await readText(request, 1_000_000);
    if (raw.length > 1_000_000)
      return new Response("Too large", { status: 413 });
    event = client.webhooks.constructEvent(
      raw,
      request.headers.get("stripe-signature") || "",
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const supported = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ];
  if (!supported.includes(event.type)) return Response.json({ received: true });
  try {
    const original = event.data.object as Stripe.Checkout.Session;
    const current = await client.checkout.sessions.retrieve(original.id);
    await processPayment(event.id, event.type, snapshot(current));
    return Response.json({ received: true });
  } catch {
    console.error("Stripe webhook processing failed", event.id);
    return new Response("Processing failed", { status: 500 });
  }
}
