import { getEvent } from "@/lib/db";
import { eventCalendarIcs } from "@/lib/email/calendar";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const event = await getEvent((await params).slug);
  if (!event || !event.isPublished || event.status === "draft") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(eventCalendarIcs(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
