import { eventOgImage, ogSize } from "@/lib/og";
import { getEvent, inventory } from "@/lib/db";
import { initialEvent } from "@/lib/event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt =
  "Afro Dance Fitness Nanaimo with Big Mama Fitness — Saturday dance workout";
export const size = ogSize;
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const event = await getEvent((await params).slug);
  if (!event || !event.isPublished || event.status === "draft") {
    return eventOgImage(initialEvent, 0);
  }
  const sold = (await inventory(event.id)).sold;
  return eventOgImage(event, sold);
}
