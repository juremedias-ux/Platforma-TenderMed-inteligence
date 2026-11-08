import type { MetadataRoute } from "next";
import { isIndexingAllowed } from "@/lib/config/seo";
import { siteConfig } from "@/lib/config/site";

/**
 * Crawling is allowed only on the configured production domain. Robots rules
 * are advisory and are not an access-control mechanism.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexingAllowed() || !siteConfig.url) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
