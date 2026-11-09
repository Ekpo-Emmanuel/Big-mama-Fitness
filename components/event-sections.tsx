import Image from "next/image";
import {
  type DanceEvent,
  eventDate,
  eventTime,
  eventState,
  money,
} from "@/lib/event";
import { content } from "@/lib/content";
import { EventCta } from "./event-cta";
import { Section, Eyebrow, headingClass } from "./ui";
import { MotionValue, Reveal } from "./motion";

type Props = { event: DanceEvent; sold: number };
export function CapacityIndicator({ event, sold }: Props) {
  const state = eventState(event, sold);
  return (
    <p className="text-sm font-semibold">
      <MotionValue value={`${state}-${sold}`}>
        {state === "open"
          ? `${Math.max(0, event.capacity - sold)} spots remaining`
          : {
              sold_out: "This class is full",
              completed: "This event has finished",
              cancelled: "This event has been cancelled",
              closed: "Registration is closed",
              draft: "Event not published",
            }[state]}
      </MotionValue>
    </p>
  );
}
export function EventHero({ event, sold }: Props) {
  return (
    <Section className="!pt-7 sm:!pt-10">
      <div className="mb-10 flex items-center justify-between gap-4 pb-5">
        <p className="max-w-48 text-sm font-black uppercase leading-tight">
          {event.shortName}
        </p>
      </div>
      <div className="grid items-center gap-10 lg:grid-cols-[1.12fr_1fr] lg:gap-14">
        <div className="motion-hero">
          <Eyebrow>Less overthinking. More dancing.</Eyebrow>
          <h1 className="max-w-2xl font-display text-[clamp(2.5rem,5.8vw,5.6rem)] leading-[0.98] tracking-tight uppercase">
            {event.headline}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed sm:text-lg">
            {event.subheadline}
          </p>
          <p className="mt-6 font-bold">
            {eventDate(event)}
            <br />
            <span className="font-normal">
              {eventTime(event)} – {eventTime(event, event.endsAt)}
            </span>
          </p>
          <div className="mt-7">
            <EventCta className="w-full max-w-md" event={event} sold={sold} />
          </div>
          <div className="mt-4">
            <CapacityIndicator event={event} sold={sold} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink/55">
            {content.reassurance.join(" · ")}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] bg-lilac p-4 sm:p-6">
          <Image
            src={event.heroImageUrl || "/afro-fit-hero-img.png"}
            alt="Afro-inspired dance and movement"
            width={720}
            height={900}
            priority
            className="aspect-[4/5] w-full rounded-2xl object-cover"
          />
        </div>
      </div>
    </Section>
  );
}
export function EventBenefits() {
  return (
    <div className="bg-sun">
      <Section>
        <Eyebrow>A workout with a different beat</Eyebrow>
        <h2 className={`${headingClass} max-w-2xl`}>
          Fitness you’ll actually look forward to.
        </h2>
        <Reveal className="mt-10 grid gap-8 sm:grid-cols-3">
          {content.benefits.map((b) => (
            <article key={b.title} className="border-t border-ink/30 pt-5">
              <h3 className="font-display text-5xl uppercase">{b.title}</h3>
              <p className="mt-3 max-w-xs leading-relaxed">{b.body}</p>
            </article>
          ))}
        </Reveal>
      </Section>
    </div>
  );
}
export function BeginnerReassurance() {
  return (
    <Section className="grid gap-8 md:grid-cols-2">
      <div>
        <Eyebrow>Two left feet? You’re in.</Eyebrow>
        <h2 className={headingClass}>
          <span className="text-ink/55">“I can’t dance.”</span>
          <br />
          Perfect.
          <br />
          You don’t need to.
        </h2>
      </div>
      <div className="self-center space-y-5 text-lg leading-relaxed">
        <p>
          This isn’t a dance audition. Brenda guides the movements. You set your
          pace.
        </p>
        <p>
          Miss a step? Keep moving. Need a break? Take one. Coming alone? You
          belong here, too.
        </p>
        <p className="font-bold">No perfect moves. Just your moves.</p>
      </div>
    </Section>
  );
}
export function EventExperience({ event }: { event: DanceEvent }) {
  return (
    <div className="bg-ink text-cream text-center mx-auto">
      <Section>
        <Eyebrow>Turn the music up. Let the day go.</Eyebrow>
        <h2 className={`${headingClass} max-w-4xl mx-auto`}>
          Afrobeats playing.
          <br />
          Everyone moving.
          <br />
          <span className="text-sun">Nobody judging.</span>
        </h2>
        <p className="mt-7 max-w-xl text-lg leading-relaxed mx-auto">
          {event.description}
        </p>
        {event.heroVideoUrl && (
          <video
            controls
            playsInline
            preload="none"
            poster={event.heroImageUrl || undefined}
            className="mt-8 w-full rounded-2xl"
            aria-label="An introduction to the class"
          >
            <source src={event.heroVideoUrl} />
          </video>
        )}
      </Section>
    </div>
  );
}
export function EventSchedule({ event }: { event: DanceEvent }) {
  const schedule = [
    [
      event.startsAt,
      "Arrive + settle in",
      "Say hello, find your space, and get ready.",
    ],
    [
      event.workoutStartsAt,
      "Find your rhythm",
      "Warm-up and guided Afro Dance Fitness.",
    ],
    [
      event.workoutEndsAt,
      "Cool down + connect",
      "Catch your breath and enjoy the good energy.",
    ],
    [
      event.endsAt,
      "Take that feeling home",
      "Your evening is just getting started.",
    ],
  ].filter((row, index, rows) => {
    // Collapse duplicate timestamps when doors == workout start or end == workout end.
    if (index === 0) return true;
    return row[0] !== rows[index - 1][0];
  });
  const locationLine = event.venueName
    ? `${event.venueName}, ${event.addressLine1}`
    : event.addressLine1;
  return (
    <Section className="grid gap-10 md:grid-cols-2">
      <div>
        <Eyebrow>Your evening, at a glance</Eyebrow>
        <h2 className={headingClass}>
          Show up.
          <br />
          We’ll take it
          <br />
          from there.
        </h2>
        <p className="mt-6 leading-relaxed">
          {eventDate(event)}
          <br />
          {locationLine}
          <br />
          {event.city}, {event.province} {event.postalCode}
        </p>
      </div>
      <ol>
        {schedule.map(([time, title, body]) => (
          <li
            key={time}
            className="grid grid-cols-[6rem_1fr] gap-4 border-b border-ink/20 py-5"
          >
            <span className="text-sm font-bold">{eventTime(event, time)}</span>
            <div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
export function InstructorSection({ event }: { event: DanceEvent }) {
  const portrait = event.instructorImageUrl || "/instructor.png";
  return (
    <Section className="!pt-0">
      <div className="grid items-center gap-8 rounded-3xl bg-lilac p-6 sm:p-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-12 lg:p-12">
        {portrait ? (
          <figure className="min-w-0">
            <Image
              src={portrait}
              alt={`${event.instructorName}, class instructor`}
              width={640}
              height={800}
              sizes="(min-width: 768px) 32vw, 90vw"
              className="aspect-[4/5] w-full rounded-2xl object-cover object-top"
            />
            <figcaption className="mt-4 font-display text-3xl leading-[0.95] uppercase sm:text-4xl">
              Hello, I’m {event.instructorName}.
            </figcaption>
          </figure>
        ) : (
          <p className="font-display text-[clamp(3.5rem,9vw,5.8rem)] uppercase sm:text-7xl">
            Hello,
            <br />
            I’m
            <br />
            {event.instructorName}.
          </p>
        )}
        <div className="self-center">
          <Eyebrow>The energy behind the class</Eyebrow>
          <h2 className="font-display text-4xl uppercase sm:text-5xl">
            A friendly face.
            <br />A feel-good workout.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed">
            {event.instructorBio}
          </p>
        </div>
      </div>
    </Section>
  );
}
export function TicketOffer({ event, sold }: Props) {
  return (
    <Section
      id="tickets"
      className="grid gap-8 border-t border-ink/20 md:grid-cols-2"
    >
      <div>
        <Eyebrow>A little commitment. A lot of energy.</Eyebrow>
        <h2 className={headingClass}>
          One evening.
          <br />
          One workout.
          <br />
        </h2>
        <p className="mt-6 max-w-md leading-relaxed">
          A small class, with room to feel comfortable. {event.capacity} seats
          available.
        </p>
      </div>
      <div className="rounded-3xl border-2 border-ink p-7 sm:p-10">
        <p className="font-display text-7xl">
          {money(event)}{" "}
          <span className="font-sans text-base font-bold">
            {event.currency}
          </span>
        </p>
        <ul className="my-6 space-y-3">
          {[
            "Approximately 60 minutes of guided movement",
            "Beginner-friendly instruction",
            "Afrobeats and a welcoming group",
            "One-time payment. No membership.",
          ].map((x) => (
            <li key={x} className="flex gap-3">
              <span aria-hidden="true">✓</span>
              {x}
            </li>
          ))}
        </ul>
        <EventCta className="w-full" event={event} sold={sold} />
        <div className="mt-4">
          <CapacityIndicator event={event} sold={sold} />
        </div>
      </div>
    </Section>
  );
}
export function EventFaq({ event }: { event: DanceEvent }) {
  return (
    <Section>
      <Eyebrow>A few things before you come</Eyebrow>
      <h2 className={headingClass}>Good questions.</h2>
      <div className="mt-8">
        {[
          ...content.faq,
          [
            "How much is it, and how many spots are available?",
            `${money(event)} ${event.currency}. Maximum ${event.capacity} Seats available.`,
          ],
        ].map(([q, a]) => (
          <details
            key={q}
            className="motion-disclosure group border-b border-ink/20 py-5"
          >
            <summary className="cursor-pointer py-1 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4">
              {q}
            </summary>
            <p className="mt-4 max-w-3xl leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
export function FinalCta({ event, sold }: Props) {
  return (
    <div className="bg-orange">
      <Section className="text-center">
        <h2 className={`${headingClass} mx-auto max-w-xl`}>
          {content.finalHeadline}
        </h2>
        {/* <p className="my-6">
          {eventDate(event)} · {event.city} · {money(event)} {event.currency}
        </p> */}
        <EventCta className="mt-6" event={event} sold={sold} />
      </Section>
    </div>
  );
}
export function StickyMobileCta({ event, sold }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/15 bg-cream/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden">
      <EventCta event={event} sold={sold} className="w-full" />
    </div>
  );
}
