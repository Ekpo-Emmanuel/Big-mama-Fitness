import { siteOgImage, ogSize } from "@/lib/og";
import { getFeaturedEvent } from "@/lib/db";
import { initialEvent } from "@/lib/event";

export const runtime = "nodejs";
export const alt = `${initialEvent.name} with Big Mama Fitness`;
export const size = ogSize;
export const contentType = "image/png";

export default async function TwitterImage() {
  const event = await getFeaturedEvent();
  return siteOgImage(event);
}
