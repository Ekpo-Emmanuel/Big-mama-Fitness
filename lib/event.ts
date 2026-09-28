export type EventStatus =
  "draft" | "published" | "sold_out" | "completed" | "cancelled";
export interface DanceEvent {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  headline: string;
  subheadline: string;
  description: string;
  startsAt: string;
  endsAt: string;
  workoutStartsAt: string;
  workoutEndsAt: string;
  timezone: string;
  venueName: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  priceCents: number;
  currency: string;
  capacity: number;
  targetAttendance: number;
  status: EventStatus;
  isPublished: boolean;
  registrationOpen: boolean;
  instructorName: string;
  instructorBio: string;
  contactEmail: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  instructorImageUrl: string;
  waiverVersion: string;
  waiverText: string;
}
export const initialEvent: DanceEvent = {
  id: "afro-oct-2026",
  slug: "afro-dance-fitness",
  name: "Afro Dance Fitness Nanaimo",
  shortName: "Afro Dance Fitness",
  headline: "Your Saturday workout should feel like a party.",
  subheadline:
    "Afrobeats. Easy-to-follow movement. A room full of good energy. Join Brenda for a beginner-friendly dance workout in Nanaimo.",
  description:
    "Approximately 60 minutes of guided Afro-inspired movement inside a welcoming 90-minute event experience. Open to everyone.",
  startsAt: "2026-10-17T17:00:00-07:00",
  endsAt: "2026-10-17T18:30:00-07:00",
  workoutStartsAt: "2026-10-17T17:15:00-07:00",
  workoutEndsAt: "2026-10-17T18:15:00-07:00",
  timezone: "America/Vancouver",
  venueName: "",
  addressLine1: "1969 Boxwood Rd",
  city: "Nanaimo",
  province: "BC",
  postalCode: "V9S 5X9",
  country: "CA",
  priceCents: 1000,
  currency: "CAD",
  capacity: 20,
  targetAttendance: 15,
  status: "published",
  isPublished: true,
  registrationOpen: true,
  instructorName: "Brenda",
  instructorBio:
    "Join me for a welcoming class built around Afro music, movement, and finding your own pace.",
  contactEmail: "",
  heroImageUrl: "/afro-fit-hero-img.png",
  heroVideoUrl: "",
  instructorImageUrl: "/instructor.png",
  waiverVersion: "bmf-afro-dance-2026-10-v1",
  waiverText: `Participation Waiver

I understand that participating in Afro Dance Fitness involves physical activity and may include risks such as muscle strains, sprains, falls, dizziness, fatigue, or other injury.

I voluntarily choose to participate and understand that I am responsible for deciding whether I am physically able to take part safely. If I have any medical condition, injury, pregnancy, or other health concern that may affect my ability to exercise, I understand that I should seek appropriate medical advice before participating.

I agree to follow reasonable safety instructions provided by the instructor and to stop participating if I feel pain, dizziness, shortness of breath, or otherwise feel unable to continue safely.

By participating, I voluntarily assume the risks associated with the class and agree, to the extent permitted by law, to release and hold harmless Big Mama Fitness, the instructor, organizers, and venue from claims arising from injuries or losses connected with my participation, except where liability cannot legally be excluded.

I understand that this waiver does not replace medical advice and that no particular fitness result is guaranteed.

By checking the box below, I confirm that I have read and understood this waiver and voluntarily agree to its terms.`,
};
export function eventState(event: DanceEvent, sold: number, now = Date.now()) {
  if (!event.isPublished || event.status === "draft") return "draft";
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "completed" || now >= Date.parse(event.endsAt))
    return "completed";
  if (event.status === "sold_out" || sold >= event.capacity) return "sold_out";
  if (!event.registrationOpen || now >= Date.parse(event.startsAt))
    return "closed";
  return "open";
}
export function money(event: Pick<DanceEvent, "priceCents" | "currency">) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: event.currency,
    maximumFractionDigits: 0,
  }).format(event.priceCents / 100);
}
export function eventDate(event: DanceEvent) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}
export function eventDateFull(event: DanceEvent) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}
export function eventTime(event: DanceEvent, value = event.startsAt) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  }).format(new Date(value));
}
