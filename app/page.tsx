import { getFeaturedEvent, inventory } from "@/lib/db";
import { LandingPage } from "@/components/landing-page";
import { eventSchema, safeJson } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const event = await getFeaturedEvent();
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
