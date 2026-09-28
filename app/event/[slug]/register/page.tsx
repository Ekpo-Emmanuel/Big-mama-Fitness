import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, inventory } from "@/lib/db";
import { eventState, eventDate, money } from "@/lib/event";
import { RegistrationForm } from "@/components/registration-form";
import { Section, Notice, headingClass } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reserve your spot",
  robots: { index: false, follow: false },
};
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const event = await getEvent((await params).slug);
  if (!event || !event.isPublished || event.status === "draft") notFound();
  const open = eventState(event, (await inventory(event.id)).sold) === "open";
  return (
    <main id="main">
      <Section className="max-w-2xl">
        <Link
          href={`/event/${event.slug}`}
          className="inline-block min-h-11 text-sm underline"
        >
          ← Back to the class
        </Link>
        <h1 className={`${headingClass} mt-6`}>
          Your spot.
          <br />
          Your good energy.
        </h1>
        <p className="my-6 leading-relaxed">
          {event.name}
          <br />
          {eventDate(event)} · {money(event)} {event.currency}
        </p>
        {open ? (
          <RegistrationForm
            event={event}
            ready={Boolean(
              process.env.STRIPE_SECRET_KEY &&
              process.env.STRIPE_WEBHOOK_SECRET &&
              process.env.APP_URL &&
              event.waiverText &&
              event.waiverVersion,
            )}
          />
        ) : (
          <Notice>
            Registration is closed.{" "}
            <Link
              href={`/event/${event.slug}#next-class`}
              className="underline"
            >
              Hear about the next class.
            </Link>
          </Notice>
        )}
      </Section>
    </main>
  );
}
