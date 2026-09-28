import { assertProductionEmailSafety } from "./safety";

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
}

export interface EmailProvider {
  send(message: EmailMessage, key: string): Promise<{ id: string | null }>;
}

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function emailConfigured() {
  return configured();
}

/** Redirect only when EMAIL_TEST_REDIRECT is explicitly set to a non-empty value. */
export function applyEmailTestRedirect<
  T extends { to: string[]; subject: string },
>(message: T): T {
  const redirect = process.env.EMAIL_TEST_REDIRECT?.trim();
  if (!redirect) return message;
  return {
    ...message,
    to: [redirect],
    subject: `[test · ${message.to.join(", ")}] ${message.subject}`,
  };
}

export async function sendViaResend(message: EmailMessage, key: string) {
  if (!configured()) throw new Error("Email not configured");
  assertProductionEmailSafety();
  const outbound = applyEmailTestRedirect(message);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: outbound.to,
      subject: outbound.subject,
      text: outbound.text,
      html: outbound.html,
      ...(outbound.reply_to ? { reply_to: outbound.reply_to } : {}),
    }),
  });
  const body = (await response.json()) as {
    id?: string;
    message?: string;
    name?: string;
  };
  if (!response.ok) throw new Error(body.message || "Resend delivery failed");
  return { id: body.id ?? null };
}

/** One Resend request per recipient (organizer fan-out; confirmation stays single). */
export function messagesPerRecipient(message: EmailMessage): EmailMessage[] {
  return message.to.map((recipient) => ({
    ...message,
    to: [recipient],
  }));
}

export function recipientSendKey(jobId: string, recipient: string) {
  return `${jobId}:${recipient.trim().toLowerCase()}`;
}

export const resendProvider: EmailProvider = {
  send: sendViaResend,
};
