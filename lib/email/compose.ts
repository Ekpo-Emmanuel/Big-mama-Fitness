import { uniqueEmails } from "./recipients";
import type { Attendee } from "../booking";
import type { DanceEvent } from "../event";
import { publicSiteOrigin } from "./origin";
import { feedbackPageUrl } from "../feedback";
import {
  confirmationEmail,
  followupEmail,
  organizerEmail,
  reminder24Email,
  reminderSameDayEmail,
  type ComposedEmail,
  type EmailKind,
} from "./templates";

export function guestEmailAllowed(
  attendee: Attendee,
  event: DanceEvent,
  kind: string,
  now = Date.now(),
) {
  if (attendee.payment_status !== "paid") return false;
  if (attendee.attendee_status === "cancelled") return false;
  if (event.status === "cancelled") return false;
  if (kind.startsWith("reminder") && now >= Date.parse(event.startsAt))
    return false;
  return true;
}

export function composeEmail(input: {
  kind: string;
  attendee: Attendee;
  event: DanceEvent;
  sold: number;
  organizerEmails: string[];
  now?: number;
}): ComposedEmail | null {
  const { kind, attendee, event, sold, organizerEmails, now } = input;
  if (kind === "organizer") {
    if (attendee.payment_status !== "paid") return null;
    if (attendee.attendee_status === "cancelled") return null;
    if (event.status === "cancelled") return null;
    const to = uniqueEmails(organizerEmails);
    if (!to.length) return null;
    return organizerEmail(event, attendee, sold, to);
  }
  if (!guestEmailAllowed(attendee, event, kind, now)) return null;
  if (kind === "confirmation") return confirmationEmail(event, attendee);
  if (kind === "reminder_24") return reminder24Email(event, attendee);
  if (kind === "reminder_3") return reminderSameDayEmail(event, attendee);
  if (kind === "followup") {
    if (!attendee.feedback_token) return null;
    const page = `${publicSiteOrigin()}/event/${event.slug}`;
    return followupEmail(
      event,
      attendee,
      feedbackPageUrl(event, attendee.feedback_token),
      attendee.marketing_consent ? page : undefined,
    );
  }
  return null;
}

export const emailKinds: EmailKind[] = [
  "confirmation",
  "organizer",
  "reminder_24",
  "reminder_3",
  "followup",
];
