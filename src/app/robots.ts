import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/broker", "/dashboard"],
    },
    sitemap: "https://dowarly.com/sitemap.xml",
  };
}
