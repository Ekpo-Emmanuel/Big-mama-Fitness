import { eventTime, money, type DanceEvent } from "../event";
import type { Attendee } from "../booking";
import {
  calendarIcsUrl,
  eventDateLong,
  eventVenue,
  googleCalendarUrl,
  registeredAtDisplay,
} from "./calendar";

const CREAM = "#fff9ef";
const INK = "#321b39";
const ORANGE = "#f45d35";
const LILAC = "#dfceed";
const SUN = "#f6d76b";
const DISPLAY = "'Anton', Impact, 'Arial Narrow', Inter, sans-serif";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
const BRAND = "Big Mama Fitness";

export type EmailKind =
  "confirmation" | "organizer" | "reminder_24" | "reminder_3" | "followup";

export type ComposedEmail = {
  subject: string;
  text: string;
  html: string;
  to: string[];
};

function wrap(title: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet" />
  <!--[if mso]>
  <style type="text/css">
    h1, h2, h3 { font-family: Impact, Arial Narrow, sans-serif !important; }
    body, p, td, a { font-family: sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${CREAM};color:${INK};font-family:${SANS};font-size:16px;line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CREAM};overflow:hidden;">
          <tr>
            <td style="height:6px;line-height:6px;background:${ORANGE};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${SUN};padding:18px 24px;">
              <p style="margin:0;font-family:${SANS};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.04em;line-height:1.2;color:${INK};">${BRAND}</p>
              <p style="margin:4px 0 0;font-family:${SANS};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${INK};">Nanaimo</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 28px;font-family:${SANS};font-size:12px;color:${INK};">
              ${BRAND}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function displayHeading(text: string, size = "36px") {
  return `<h1 style="margin:0 0 16px;font-family:${DISPLAY};font-size:${size};font-weight:400;line-height:1.05;letter-spacing:-0.02em;text-transform:uppercase;color:${INK};">${text}</h1>`;
}

function bodyText(text: string, extra = "") {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK};${extra}">${text}</p>`;
}

function eyebrow(text: string) {
  return `<p style="margin:0 0 10px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK};">${escapeHtml(text)}</p>`;
}

function factRow(label: string, value: string, last = false) {
  const border = last ? "0" : `1px solid ${INK}26`;
  return `<tr>
    <td style="padding:14px 0;border-bottom:${border};">
      <p style="margin:0 0 4px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK};">${escapeHtml(label)}</p>
      <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.45;color:${INK};">${value}</p>
    </td>
  </tr>`;
}

function eventCard(event: DanceEvent, label = "Your plans, sorted") {
  const where = [
    event.venueName ? `${escapeHtml(event.venueName)}<br />` : "",
    escapeHtml(eventVenue(event)),
  ].join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LILAC};border-radius:24px;">
    <tr>
      <td style="padding:22px 20px 8px;">
        ${eyebrow(label)}
        <h2 style="margin:0 0 18px;font-family:${DISPLAY};font-size:28px;font-weight:400;line-height:1.1;text-transform:uppercase;color:${INK};">${escapeHtml(event.name)}</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${factRow("Date", escapeHtml(eventDateLong(event)))}
          ${factRow("Time", `${escapeHtml(eventTime(event))} – ${escapeHtml(eventTime(event, event.endsAt))}<br /><span style="font-size:13px;color:${INK}bf;">Local time · ${escapeHtml(event.timezone.replaceAll("_", " "))}</span>`)}
          ${factRow("Location", where, true)}
        </table>
      </td>
    </tr>
  </table>`;
}

function bringList() {
  const items = [
    ["Water.", "Bring a bottle. You’ll want it after the music starts."],
    ["Clothes.", "Comfortable workout clothes. Nothing fancy."],
    ["Shoes.", "Athletic shoes you can move in."],
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;background:${SUN};border-radius:24px;">
    <tr>
      <td style="padding:22px 20px 24px;">
        ${eyebrow("Show up ready")}
        <h2 style="margin:0 0 18px;font-family:${DISPLAY};font-size:32px;font-weight:400;line-height:1.05;text-transform:uppercase;color:${INK};">What to bring.</h2>
        ${items
          .map(
            (
              [title, body],
              i,
            ) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:14px 0 ${i === items.length - 1 ? "0" : "4px"};border-top:1px solid ${INK}4d;">
              <p style="margin:0;font-family:${DISPLAY};font-size:28px;font-weight:400;line-height:1;text-transform:uppercase;color:${INK};">${escapeHtml(title)}</p>
              <p style="margin:8px 0 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK};">${escapeHtml(body)}</p>
            </td>
          </tr>
        </table>`,
          )
          .join("")}
      </td>
    </tr>
  </table>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:${INK};color:${CREAM};text-decoration:none;font-family:${SANS};font-weight:700;font-size:14px;padding:14px 22px;border-radius:999px;">${escapeHtml(label)} ↗</a>
  </p>`;
}

function calendarActions(google: string, ics: string) {
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:${INK};font-family:${SANS};font-weight:700;text-decoration:underline;">${escapeHtml(label)}</a>`;
  return `<p style="margin:24px 0 8px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${INK};">Add to calendar</p>
    <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.7;">
      ${link(google, "Google Calendar")}
      <span style="color:${INK};">&nbsp;|&nbsp;</span>
      ${link(ics, "Apple / Outlook (.ics)")}
    </p>`;
}

export function confirmationEmail(
  event: DanceEvent,
  guest: Attendee,
): ComposedEmail {
  const subject = "You're in! Afro Dance Fitness is confirmed 🔥";
  const when = `${eventDateLong(event)} · ${eventTime(event)} – ${eventTime(event, event.endsAt)}`;
  const where = eventVenue(event);
  const google = googleCalendarUrl(event);
  const ics = calendarIcsUrl(event);
  const text = `Hi ${guest.first_name},

You're in. Payment went through and your spot is confirmed.

${event.name}
${when}
${where}

Arrive a little early so you can settle in before movement starts at ${eventTime(event, event.workoutStartsAt)}.

Bring:
- a water bottle
- comfortable workout clothes
- athletic shoes you can move in

Add to calendar
Google Calendar: ${google}
Apple / Outlook (.ics): ${ics}

See you on the floor.
Brenda`;
  const html = wrap(
    subject,
    `${displayHeading(`You’re in, ${escapeHtml(guest.first_name)}.`)}
    ${bodyText(`Your spot is officially confirmed. Get ready for an uplifting, high-vibes session of community Afrobeats movement.`)}
    ${eventCard(event)}
    ${bodyText(`Arrive a little early so you can settle in before movement starts at ${escapeHtml(eventTime(event, event.workoutStartsAt))}.`, "margin:20px 0 0;")}
    ${bringList()}
    ${calendarActions(google, ics)}
    ${bodyText("See you on the floor.", "margin:24px 0 0;")}`,
  );
  return { subject, text, html, to: [guest.email] };
}

export function organizerEmail(
  event: DanceEvent,
  guest: Attendee,
  sold: number,
  recipients: string[],
): ComposedEmail {
  const name = `${guest.first_name} ${guest.last_name}`;
  const subject = `New registration: ${name}`;
  const amount = money(event);
  const registered = registeredAtDisplay(guest.registered_at, event.timezone);
  const text = `New paid registration

Guest: ${name}
Email: ${guest.email}
Ticket: ${amount} ${event.currency}
Sold: ${sold} / ${event.capacity}
Event: ${event.name}
Registered: ${registered}`;
  const html = wrap(
    subject,
    `${displayHeading("New registration")}
    ${bodyText(`<strong>${escapeHtml(name)}</strong> just paid for ${escapeHtml(event.name)}.`)}
    ${eventCard(event, "Event details")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      ${factRow("Email", escapeHtml(guest.email))}
      ${factRow("Ticket", `${escapeHtml(amount)} ${escapeHtml(event.currency)}`)}
      ${factRow("Tickets sold", `${sold} / ${event.capacity}`)}
      ${factRow("Registered", escapeHtml(registered), true)}
    </table>`,
  );
  return { subject, text, html, to: recipients };
}

export function reminder24Email(
  event: DanceEvent,
  guest: Attendee,
): ComposedEmail {
  const subject = "Tomorrow: Afro Dance Fitness 🔥";
  const when = `${eventDateLong(event)} · ${eventTime(event)} – ${eventTime(event, event.endsAt)}`;
  const where = eventVenue(event);
  const text = `Hi ${guest.first_name},

Tomorrow is class day.

${event.name}
${when}
${where}

Arrive a little early. Bring a water bottle, comfortable workout clothes, and athletic shoes.

The music is ready. See you there.`;
  const html = wrap(
    subject,
    `${displayHeading("Tomorrow we move.")}
    ${bodyText(`Afro Dance Fitness is tomorrow. The music is ready.`)}
    ${eventCard(event)}
    ${bodyText("Arrive a little early so you’re settled before we start.", "margin:20px 0 0;")}
    ${bringList()}`,
  );
  return { subject, text, html, to: [guest.email] };
}

export function reminderSameDayEmail(
  event: DanceEvent,
  guest: Attendee,
): ComposedEmail {
  const subject = "See you soon 🔥";
  const text = `Hi ${guest.first_name},

See you soon. Class starts at ${eventTime(event)}.

${eventVenue(event)}

Bring water. Arrive a little early and find a spot you like.

Can't wait.`;
  const html = wrap(
    subject,
    `${displayHeading("See you soon.")}
    ${bodyText(`We start at ${escapeHtml(eventTime(event))}.`)}
    ${eventCard(event)}
    ${bodyText("Bring water. Arrive a little early and find a spot you like.")}`,
  );
  return { subject, text, html, to: [guest.email] };
}

export function followupEmail(
  event: DanceEvent,
  guest: Attendee,
  feedbackUrl: string,
  eventPageUrl?: string,
): ComposedEmail {
  const subject = "Thanks for bringing the energy 🔥";
  let text = `Hi ${guest.first_name},

Thanks for bringing the energy 🔥

We'd love to know how the class felt for you. It only takes a few seconds.

Rate the class: ${feedbackUrl}`;
  if (guest.marketing_consent && eventPageUrl)
    text += `\n\nWant the next class? ${eventPageUrl}`;
  const extra = guest.marketing_consent && eventPageUrl
    ? button(eventPageUrl, "See upcoming dates")
    : "";
  const html = wrap(
    subject,
    `${displayHeading("Thanks for bringing the energy 🔥")}
    ${bodyText(`We'd love to know how the class felt for you. It only takes a few seconds.`)}
    ${button(feedbackUrl, "Rate the class")}
    ${extra}`,
  );
  return { subject, text, html, to: [guest.email] };
}
