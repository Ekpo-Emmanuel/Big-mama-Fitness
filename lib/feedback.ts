import { publicSiteOrigin } from "./email/origin";
import type { DanceEvent } from "./event";

/** Feedback links expire 30 days after event end. */
export const FEEDBACK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const FEEDBACK_SENTIMENTS = [
  "loved",
  "good",
  "okay",
  "not_for_me",
] as const;

export type FeedbackSentiment = (typeof FEEDBACK_SENTIMENTS)[number];

export const FEEDBACK_SENTIMENT_LABELS: Record<FeedbackSentiment, string> = {
  loved: "Loved it",
  good: "It was good",
  okay: "It was okay",
  not_for_me: "Not for me",
};

export const FEEDBACK_TEXT_MAX = 500;

export function feedbackExpiresAt(endsAt: string) {
  return Date.parse(endsAt) + FEEDBACK_TTL_MS;
}

export function feedbackExpired(endsAt: string, now = Date.now()) {
  return now > feedbackExpiresAt(endsAt);
}

export function feedbackPageUrl(event: Pick<DanceEvent, "slug">, token: string) {
  return `${publicSiteOrigin()}/event/${event.slug}/feedback?token=${encodeURIComponent(token)}`;
}

export function isFeedbackToken(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}
