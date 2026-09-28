import { notFound } from "next/navigation";
import { getEvent, inventory } from "@/lib/db";
import { LandingPage } from "@/components/landing-page";
import { eventMetadata, eventSchema, safeJson } from "@/lib/seo";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const event = await getEvent((await params).slug);
  if (!event || !event.isPublished || event.status === "draft") return {};
  return eventMetadata(event);
}
export default async function EventPage({ params }: Props) {
  const event = await getEvent((await params).slug);
  if (!event || !event.isPublished || event.status === "draft") notFound();
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
