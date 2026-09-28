import { readText } from "@/lib/http";
import { api, convexClient, internalSecret, withConvex } from "@/lib/convex";
import {
  mapResendDeliveryStatus,
  parseResendWebhookPayload,
  verifyResendWebhook,
} from "@/lib/resend-webhook";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  let raw: string;
  try {
    raw = await readText(request, 1_000_000);
  } catch {
    return new Response("Too large", { status: 413 });
  }

  try {
    verifyResendWebhook(raw, {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    }, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = parseResendWebhookPayload(parsedJson);
  if (!parsed) return Response.json({ received: true, ignored: true });

  const status = mapResendDeliveryStatus(parsed.type);
  if (!status) return Response.json({ received: true, ignored: true });

  const receiptId =
    request.headers.get("svix-id") ||
    `resend:${parsed.emailId}:${parsed.type}`;

  try {
    await withConvex(() =>
      convexClient().mutation(api.jobs.applyResendDeliveryEvent, {
        receiptId,
        providerMessageId: parsed.emailId,
        status,
        errorMessage: parsed.errorMessage,
        internalSecret: internalSecret(),
      }),
    );
    return Response.json({ received: true });
  } catch {
    console.error("Resend webhook processing failed", receiptId);
    return new Response("Processing failed", { status: 500 });
  }
}
