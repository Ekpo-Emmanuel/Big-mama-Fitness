import Image from "next/image";
import Link from "next/link";
import { type DanceEvent, eventState } from "@/lib/event";
import * as Sections from "./event-sections";
import { Section } from "./ui";
import { FutureEventLeadForm } from "./future-event-lead-form";
import { AvailabilityRefresh } from "./availability-refresh";
import { EventTracking } from "./event-tracking";
import { SocialProof } from "./social-proof";
export function LandingPage({
  event,
  sold,
}: {
  event: DanceEvent;
  sold: number;
}) {
  const state = eventState(event, sold);
  const leadContext =
    state === "open"
      ? "cant_make_current_date"
      : state === "sold_out"
        ? "current_event_sold_out"
        : "registration_closed";
  const nextClass = (
    <Section id="next-class" className="scroll-mt-6 !py-8 sm:!py-12">
      <div
        className={`rounded-[2rem] p-5 sm:p-8 lg:p-10 ${state === "open" ? "border border-ink/10 bg-lilac/40" : "bg-ink text-cream"}`}
      >
        <div className="grid items-start gap-7 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div>
            <p
              className={`mb-5 text-xs font-bold tracking-[0.18em] uppercase ${state === "open" ? "text-ink/70" : "text-sun"}`}
            >
              Next Class List
            </p>
            <h2
              id="next-class-heading"
              className="max-w-sm font-display text-4xl leading-[1.05] uppercase sm:text-5xl"
            >
              {state === "open"
                ? "Can’t make this class?"
                : state === "sold_out"
                  ? "This class is full."
                  : "Catch the next class."}
            </h2>
            <p
              className={`mt-5 max-w-sm text-base leading-relaxed ${state === "open" ? "text-ink/80" : "text-cream/85"}`}
            >
              {state === "open"
                ? "Same good energy. A different date. Join the Next Class List to hear when the next Afro Dance Fitness class opens."
                : state === "sold_out"
                  ? "Want the next one? Join the Next Class List to hear when another Afro Dance Fitness date opens."
                  : `${state === "cancelled" ? "This event has been cancelled." : state === "completed" ? "This event has finished." : "Registration is closed."} Join the Next Class List to hear when another date opens.`}
            </p>
            <p
              className={`mt-5 text-xs leading-relaxed ${state === "open" ? "text-ink/65" : "text-cream/70"}`}
            >
              No ticket purchase today. Choose your class when you’re ready.
            </p>
          </div>
          <div className="min-w-0 rounded-2xl bg-cream p-4 text-ink sm:p-6">
            <FutureEventLeadForm
              eventId={event.id}
              sourceContext={leadContext}
            />
          </div>
        </div>
      </div>
    </Section>
  );
  return (
    <main id="main" className="pb-24 md:pb-0">
      {state !== "open" && nextClass}
      <Sections.EventHero event={event} sold={sold} />
      <Sections.EventBenefits />
      <Sections.BeginnerReassurance />
      <Sections.EventExperience event={event} />
      <Sections.EventSchedule event={event} />
      <Sections.InstructorSection event={event} />
      <Sections.TicketOffer event={event} sold={sold} />
      <SocialProof />
      <Sections.EventFaq event={event} />
      <Sections.FinalCta event={event} sold={sold} />
      <AvailabilityRefresh />
      <EventTracking eventId={event.id} soldOut={state === "sold_out"} />
      {state === "open" && nextClass}
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Big Mama Fitness"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <p>Big Mama Fitness</p>
        </div>
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy policy
        </Link>
      </footer>
      <Sections.StickyMobileCta event={event} sold={sold} />
    </main>
  );
}
