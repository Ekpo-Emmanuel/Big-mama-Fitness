import { ImageResponse } from "next/og";
import { getEvent } from "@/lib/db";
import { eventDate, money } from "@/lib/event";
export const dynamic = "force-dynamic";
export const alt =
  "Afro Dance Fitness — your Saturday workout should feel like a party";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const event = await getEvent((await params).slug);
  if (!event || !event.isPublished || event.status === "draft")
    return new Response("Not found", { status: 404 });
  // ImageResponse renders a PNG without a DOM or Tailwind stylesheet; inline layout is required here.
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#dfceed",
        color: "#321b39",
        padding: 70,
      }}
    >
      <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>
        {event.shortName.toUpperCase()} / {event.city.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 80,
          fontWeight: 900,
          lineHeight: 1,
          maxWidth: 1000,
        }}
      >
        {event.headline.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          justifyContent: "space-between",
        }}
      >
        <span>{eventDate(event)}</span>
        <span>
          {money(event)} {event.currency} · Beginner friendly
        </span>
      </div>
    </div>,
    size,
  );
}
