import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/http";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/login", "/api/", "/event/*/register", "/event/*/success"],
    },
    sitemap: siteUrl() + "/sitemap.xml",
  };
}
