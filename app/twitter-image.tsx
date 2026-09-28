import { siteOgImage, ogSize } from "@/lib/og";

export const runtime = "nodejs";
export const alt =
  "Afro Dance Fitness Nanaimo with Big Mama Fitness — Saturday, Oct 17";
export const size = ogSize;
export const contentType = "image/png";

export default async function TwitterImage() {
  return siteOgImage();
}
