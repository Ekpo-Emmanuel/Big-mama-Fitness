import Link from "next/link";
import React, { type ReactNode } from "react";
import { type DanceEvent, eventTime } from "@/lib/event";
import { buttonClass, Eyebrow, headingClass } from "./ui";
import { ArrowUpRight } from "lucide-react";

type ConfirmationRecord = {
  payment_status: string;
  attendee_status: string;
} | null;
export function confirmationState(row: ConfirmationRecord) {
  if (row?.payment_status === "refunded") return "refunded";
  if (row?.attendee_status === "cancelled") return "cancelled";
  if (["failed", "cancelled"].includes(row?.payment_status || ""))
    return "failed";
  if (row?.payment_status === "paid") return "paid";
  return row?.payment_status === "pending" ? "pending" : "unknown";
}

function Icon({
  kind,
  className = "h-6 w-6",
}: {
  kind: "check" | "calendar" | "clock" | "pin";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {kind === "check" ? (
        <path d="m5 12 4 4L19 6" />
      ) : kind === "calendar" ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" />
        </>
      ) : kind === "clock" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : (
        <>
          <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      )}
    </svg>
  );
}
function Detail({
  kind,
  label,
  children,
}: {
  kind: "calendar" | "clock" | "pin";
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full gap-4 border-t border-ink/15 py-5 first:border-0 first:pt-0 last:pb-0">
      <span className="mt-1 shrink-0">
        <Icon kind={kind} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="mb-1 text-[10px] tracking-[0.18em] font-bold uppercase">
          {label}
        </dt>
        <dd className="w-full text-base leading-relaxed sm:text-lg">
          {children}
        </dd>
      </div>
    </div>
  );
}
const messages = {
  pending: {
    badge: "Payment processing",
    title: "Confirming your spot…",
    body: "Your payment confirmation is still on its way. This page checks for updates automatically for about a minute.",
    next: "Keep this page open or check your email. Your spot is confirmed only once payment is verified.",
  },
  unknown: {
    badge: "Confirmation unavailable",
    title: "Let’s check your booking.",
    body: "We couldn’t find a registration with this link. This doesn’t tell us whether your payment went through.",
    next: "Check your confirmation email for booking details, or contact the organizer before paying again.",
  },
  failed: {
    badge: "Checkout incomplete",
    title: "Your spot isn’t confirmed.",
    body: "No ticket was confirmed from this checkout.",
    next: "Return to the event page to check availability. If you see a charge, contact the organizer before trying again.",
  },
  cancelled: {
    badge: "Ticket cancelled",
    title: "Your ticket was cancelled.",
    body: "This registration is no longer active.",
    next: "Contact the organizer if you have questions about your ticket or payment.",
  },
  refunded: {
    badge: "Payment refunded",
    title: "Your payment was refunded.",
    body: "This ticket is no longer active.",
    next: "Contact the organizer if you have questions about your refund.",
  },
};

export function RegistrationConfirmation({
  event,
  row,
}: {
  event: DanceEvent;
  row: ConfirmationRecord;
}) {
  const state = confirmationState(row);
  const paid = state === "paid";
  const address = [
    event.addressLine1,
    `${event.city}, ${event.province} ${event.postalCode}`,
  ].join(", ");
  const date = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
  const calendarDate = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const calendar =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: event.name,
      dates: `${calendarDate(event.startsAt)}/${calendarDate(event.endsAt)}`,
      ctz: event.timezone,
      location: address,
      details: "Bring water, comfortable workout clothes, and athletic shoes.",
    });
  const message = paid ? null : messages[state];
  return (
    <>
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-6 sm:px-8 sm:pt-8 lg:px-12">
        <header className="flex items-center justify-between gap-4 border-b border-ink/15 pb-5">
          <Link
            href={`/event/${event.slug}`}
            className="max-w-56 font-display text-lg leading-tight uppercase focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {event.shortName}
            <span className="mt-1 block font-sans text-[10px] tracking-[0.2em]">
              {event.city}
            </span>
          </Link>
        </header>
        <div className="grid gap-9 py-10 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <section aria-labelledby="confirmation-heading">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-sun px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase">
              {paid && <Icon kind="check" className="h-4 w-4" />}
              {paid ? "Spot confirmed" : message!.badge}
            </p>
            {paid ? (
              <>
                <div className="flex items-center gap-5">
                  <h1
                    id="confirmation-heading"
                    className="font-display text-[clamp(4.5rem,12vw,8rem)] leading-[0.95] tracking-tight uppercase"
                  >
                    You’re in!
                  </h1>
                  {/* <span className="flex h-20 w-20 -rotate-12 items-center justify-center rounded-full bg-sun sm:h-24 sm:w-24">
                  <Icon kind="check" className="h-12 w-12" />
                </span> */}
                </div>
                <p className="mt-7 max-w-sm text-lg leading-relaxed">
                  Your spot is officially confirmed. Get ready for an uplifting,
                  high-vibes session of community Afrobeats movement.
                </p>
              </>
            ) : (
              <>
                <h1
                  id="confirmation-heading"
                  className="font-display text-4xl leading-[1.05] uppercase sm:text-6xl"
                >
                  {message!.title}
                </h1>
                <p className="mt-6 text-lg leading-relaxed">{message!.body}</p>
                <p className="mt-4 leading-relaxed text-ink/75">
                  {message!.next}
                </p>
              </>
            )}
          </section>
          <section
            aria-labelledby="event-details-heading"
            className="rounded-3xl bg-lilac p-6 sm:p-8"
          >
            <p className="mb-3 text-[10px] font-bold tracking-[0.18em] uppercase">
              {paid ? "Your plans, sorted" : "Event details"}
            </p>
            <h2
              id="event-details-heading"
              className="mb-7 font-display text-3xl leading-tight uppercase"
            >
              {event.name}
            </h2>
            <dl>
              <Detail kind="calendar" label="Date">
                {date}
              </Detail>
              <Detail kind="clock" label="Time">
                {eventTime(event)} – {eventTime(event, event.endsAt)}
                <span className="block text-sm text-ink/75">
                  Local time · {event.timezone.replaceAll("_", " ")}
                </span>
              </Detail>
              <Detail kind="pin" label="Location">
                {event.venueName && (
                  <span className="block">{event.venueName}</span>
                )}
                <div className="flex w-full flex-col gap-1">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>{event.addressLine1}</span>
                    <Link
                      href={`https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: address })}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-bold"
                    >
                      Open map <ArrowUpRight className="h-4 w-4" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </Link>
                  </div>
                  <span className="block text-sm text-ink/75">
                    {event.addressLine1}, {event.city}, {event.province}{" "}
                    {event.postalCode}
                  </span>
                </div>
              </Detail>
            </dl>
          </section>
        </div>
      </div>
      {paid && (
        <div className="bg-sun">
          <section
            aria-labelledby="bring-heading"
            className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12"
          >
            <Eyebrow>Show up ready</Eyebrow>
            <h2 id="bring-heading" className={`${headingClass} max-w-2xl`}>
              What to bring.
            </h2>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Water.",
                  body: "Bring a bottle. You’ll want it after the music starts.",
                },
                {
                  title: "Clothes.",
                  body: "Comfortable workout clothes. Nothing fancy.",
                },
                {
                  title: "Shoes.",
                  body: "Athletic shoes you can move in.",
                },
              ].map((item) => (
                <li key={item.title} className="border-t border-ink/30 pt-5">
                  <h3 className="font-display text-5xl uppercase">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-xs leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {paid ? (
        <div className="bg-ink text-cream">
          <section
            aria-labelledby="next-heading"
            className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12"
          >
            <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-20">
              <div>
                <Eyebrow>From this page to the first beat</Eyebrow>
                <h2 id="next-heading" className={`${headingClass} max-w-xl`}>
                  Ticket’s done.
                  <br />
                  Night isn’t.
                </h2>
              </div>
              <div>
                <ol className="border-t border-cream/20">
                  {[
                    [
                      "01",
                      "Email",
                      "Confirmation’s in your inbox. Keep this page too.",
                    ],
                    [
                      "02",
                      `Arrive ${eventTime(event)}`,
                      `Check in then. Movement starts at ${eventTime(event, event.workoutStartsAt)}`,
                    ],
                    [
                      "03",
                      "Move",
                      "No dance experience. Find your rhythm. Enjoy it.",
                    ],
                  ].map(([n, title, body]) => (
                    <li
                      key={n}
                      className="grid grid-cols-[3.25rem_1fr] gap-4 border-b border-cream/20 py-5"
                    >
                      <span className="font-display text-xl text-sun">{n}</span>
                      <div>
                        <h3 className="font-display text-3xl uppercase">
                          {title}
                        </h3>
                        <p className="mt-2 max-w-md leading-relaxed text-cream/75">
                          {body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    href={calendar}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sun px-6 py-3 text-sm font-bold text-ink hover:bg-sun/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sun"
                  >
                    <Icon kind="calendar" className="h-4 w-4" />
                    Add to Google Calendar
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <Link
                    className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-cream/40 px-6 py-3 text-sm font-bold text-cream hover:bg-cream/10 focus-visible:outline-2 focus-visible:outline-offset-4"
                    href={`/event/${event.slug}`}
                  >
                    Back to event page <span aria-hidden="true">↗</span>
                  </Link>
                  {event.contactEmail && (
                    <a
                      href={`mailto:${event.contactEmail}`}
                      className="inline-flex min-h-12 items-center justify-center px-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 sm:ml-auto"
                    >
                      Contact the organizer
                    </a>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-16 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95] tracking-tight uppercase">
              Bring your energy.
              <br />
              <span className="text-sun">We’ll bring the beat.</span>
            </p>
            <p className="mt-10 text-xs tracking-[0.16em] text-cream/55 uppercase">
              {event.shortName}
              {event.instructorName && ` · With ${event.instructorName}`}
            </p>
          </section>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-5 pb-10 sm:px-8 lg:px-12">
          <div className="flex flex-col gap-3 border-t border-ink/15 pt-7 sm:flex-row sm:flex-wrap sm:items-center">
            <Link className={buttonClass} href={`/event/${event.slug}`}>
              Back to event page <span aria-hidden="true">↗</span>
            </Link>
            {event.contactEmail && (
              <a
                href={`mailto:${event.contactEmail}`}
                className="inline-flex min-h-12 items-center justify-center px-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 sm:ml-auto"
              >
                Contact the organizer
              </a>
            )}
          </div>
          <p className="mt-8 text-center text-xs text-ink/70">
            {event.shortName}
            {event.instructorName && ` · With ${event.instructorName}`}
          </p>
        </div>
      )}
    </>
  );
}
