import type { MetadataRoute } from "next";
import { api, convexClient, withConvex } from "@/lib/convex";
import type { DanceEvent } from "@/lib/event";
import { siteUrl } from "@/lib/http";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows: { event: DanceEvent; updatedAt: string }[] = await withConvex(
    async () => {
      const client = convexClient();
      return client.query(api.events.listPublished, {});
    },
  );
  return rows.map(({ event, updatedAt }) => ({
    url: siteUrl() + "/event/" + event.slug,
    lastModified: new Date(updatedAt),
  }));
}
