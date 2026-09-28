import { getEvent, inventory } from "@/lib/db";
import { LandingPage } from "@/components/landing-page";
import { initialEvent } from "@/lib/event";
import { eventSchema, safeJson } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Serve landing at `/` so WhatsApp/OG scrapers of www.bigmamafit.ca
  // get the root opengraph-image (not a redirect to the event route).
  const event = (await getEvent(initialEvent.slug)) ?? initialEvent;
  const sold = (await inventory(event.id)).sold;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(eventSchema(event, sold)) }}
      />
      <LandingPage event={event} sold={sold} />
    </>
  );
}
