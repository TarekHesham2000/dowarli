import type { MetadataRoute } from "next";
import { getPublicSitemapUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/broker", "/dashboard"],
    },
    sitemap: getPublicSitemapUrl(),
  };
}
