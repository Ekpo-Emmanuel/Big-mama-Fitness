import Image from "next/image";
import Link from "next/link";
import { type DanceEvent, eventState } from "@/lib/event";
import * as Sections from "./event-sections";
import { Notice, Section } from "./ui";
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
  return (
    <main id="main" className="pb-24 md:pb-0">
      {state !== "open" && (
        <Section className="!py-5">
          <Notice>
            {state === "sold_out"
              ? "This class is full. Join the next-class list below."
              : state === "cancelled"
                ? "This event has been cancelled. Registration is closed."
                : state === "completed"
                  ? "This event has finished. Keep in touch for the next one."
                  : "Registration is currently closed."}
          </Notice>
        </Section>
      )}
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
      {state !== "open" && (
        <Section id="next-class">
          <h2 className="text-3xl font-bold">Be part of the next class.</h2>
          <p className="mt-4">
            Missed this one? Leave your details to hear about future classes.
          </p>
          <FutureEventLeadForm eventId={event.id} />
        </Section>
      )}
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
