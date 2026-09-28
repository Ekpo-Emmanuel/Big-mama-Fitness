import type { DanceEvent } from "../event";
import { publicSiteOrigin } from "./origin";

export function eventVenue(event: DanceEvent) {
  return `${event.addressLine1}, ${event.city}, ${event.province} ${event.postalCode}`;
}

export function eventPageUrl(event: DanceEvent) {
  return `${publicSiteOrigin()}/event/${event.slug}`;
}

export function calendarIcsUrl(event: DanceEvent) {
  return `${eventPageUrl(event)}/calendar.ics`;
}

export function calendarDescription(event: DanceEvent) {
  return [
    `${event.name} with ${event.instructorName}.`,
    "Bring a water bottle, comfortable workout clothes, and athletic shoes.",
    eventPageUrl(event),
  ].join("\n");
}

export function registeredAtDisplay(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  const period = pick("dayPeriod").replaceAll(".", "").replaceAll(" ", "").toLowerCase();
  return `${pick("day")}/${pick("month")}/${pick("year")} at ${pick("hour").padStart(2, "0")}:${pick("minute")}${period}`;
}

export function eventDateLong(event: DanceEvent) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}

export function googleCalendarUrl(event: DanceEvent) {
  const stamp = (value: string) => utcStamp(value);
  return (
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: event.name,
      dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`,
      ctz: event.timezone,
      location: eventVenue(event),
      details: calendarDescription(event),
    })
  );
}

function utcStamp(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function icsEscape(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r\n|\n|\r/g, "\\n");
}

function icsLocalStamp(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}${pick("month")}${pick("day")}T${pick("hour")}${pick("minute")}${pick("second")}`;
}

function foldLine(line: string) {
  const lines: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (cut > 1 && Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut -= 1;
    lines.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  lines.push(rest);
  return lines.join("\r\n");
}

function vancouverZone(tz: string) {
  return `BEGIN:VTIMEZONE
TZID:${tz}
BEGIN:DAYLIGHT
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
TZNAME:PDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
TZNAME:PST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`.replaceAll("\n", "\r\n");
}

export function eventCalendarIcs(event: DanceEvent) {
  const tz = event.timezone;
  const page = eventPageUrl(event);
  const host = new URL(page).hostname;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Big Mama Fitness//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    vancouverZone(tz),
    "BEGIN:VEVENT",
    foldLine(`UID:${event.id}@${host}`),
    foldLine(`DTSTAMP:${utcStamp(event.startsAt)}`),
    foldLine(`DTSTART;TZID=${tz}:${icsLocalStamp(event.startsAt, tz)}`),
    foldLine(`DTEND;TZID=${tz}:${icsLocalStamp(event.endsAt, tz)}`),
    foldLine(`SUMMARY:${icsEscape(event.name)}`),
    foldLine(`LOCATION:${icsEscape(eventVenue(event))}`),
    foldLine(`DESCRIPTION:${icsEscape(calendarDescription(event))}`),
    foldLine(`URL:${page}`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  if (event.contactEmail) {
    const organizer = foldLine(
      `ORGANIZER;CN=${icsEscape(event.instructorName)}:mailto:${event.contactEmail}`,
    );
    lines.splice(lines.indexOf("STATUS:CONFIRMED"), 0, organizer);
  } else {
    lines.splice(
      lines.indexOf("STATUS:CONFIRMED"),
      0,
      foldLine(`COMMENT:${icsEscape(`With ${event.instructorName}`)}`),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
