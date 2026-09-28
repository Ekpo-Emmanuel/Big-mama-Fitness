/** Resend / Svix delivery events we track per provider message ID. */
export const RESEND_DELIVERY_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
] as const;

export type ResendDeliveryEventType = (typeof RESEND_DELIVERY_EVENTS)[number];

export type ResendDeliveryStatus =
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "complained"
  | "suppressed";

const statusByEvent: Record<ResendDeliveryEventType, ResendDeliveryStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
};

const statusRank: Record<string, number> = {
  sent: 1,
  delayed: 2,
  delivered: 3,
  bounced: 10,
  complained: 10,
  suppressed: 10,
  failed: 10,
};

export function mapResendDeliveryStatus(
  type: string,
): ResendDeliveryStatus | null {
  if (!(type in statusByEvent)) return null;
  return statusByEvent[type as ResendDeliveryEventType];
}

/** Prefer forward progress; never leave a terminal bounce/complaint state. */
export function shouldApplyDeliveryStatus(current: string, next: string) {
  if (current === next) return false;
  const currentRank = statusRank[current] ?? 0;
  const nextRank = statusRank[next] ?? 0;
  if (currentRank >= 10) return false;
  return nextRank >= currentRank;
}

export function parseResendWebhookPayload(raw: unknown): {
  type: string;
  emailId: string;
  errorMessage: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as {
    type?: unknown;
    data?: {
      email_id?: unknown;
      bounce?: { message?: unknown };
      failed?: { reason?: unknown };
    };
  };
  if (typeof body.type !== "string") return null;
  if (!mapResendDeliveryStatus(body.type)) return null;
  const emailId = body.data?.email_id;
  if (typeof emailId !== "string" || !emailId) return null;
  const bounceMessage = body.data?.bounce?.message;
  const failReason = body.data?.failed?.reason;
  const errorMessage =
    typeof bounceMessage === "string"
      ? bounceMessage
      : typeof failReason === "string"
        ? failReason
        : null;
  return { type: body.type, emailId, errorMessage };
}
