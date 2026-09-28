import { createHmac, timingSafeEqual } from "node:crypto";

export {
  RESEND_DELIVERY_EVENTS,
  mapResendDeliveryStatus,
  parseResendWebhookPayload,
  shouldApplyDeliveryStatus,
  type ResendDeliveryEventType,
  type ResendDeliveryStatus,
} from "./resend-delivery";

/**
 * Verify Resend (Svix) webhook signature.
 * Secret format: whsec_<base64>
 * Next.js only — never import this module from Convex.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  secret: string,
  now = Date.now(),
) {
  if (!headers.id || !headers.timestamp || !headers.signature)
    throw new Error("Missing Resend webhook signature headers");
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp))
    throw new Error("Invalid Resend webhook timestamp");
  if (Math.abs(now / 1000 - timestamp) > 60 * 5)
    throw new Error("Resend webhook timestamp outside tolerance");

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "base64");
  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");
  const candidates = headers.signature.split(" ").flatMap((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && value ? [value] : [];
  });
  if (!candidates.length) throw new Error("No v1 Resend webhook signatures");
  const expectedBuf = Buffer.from(expected);
  const match = candidates.some((value) => {
    const got = Buffer.from(value);
    return (
      got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf)
    );
  });
  if (!match) throw new Error("Invalid Resend webhook signature");
}
