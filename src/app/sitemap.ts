import type { MetadataRoute } from "next";
import { isIndexingAllowed } from "@/lib/config/seo";
import { siteConfig } from "@/lib/config/site";

/**
 * Lists only indexable public pages. The demo and the draft legal pages are
 * noindex until approved, so they are not listed. Without a configured
 * domain the sitemap is empty (no placeholder URLs are published).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.url || !isIndexingAllowed()) return [];
  return [{ url: `${siteConfig.url}/`, changeFrequency: "monthly", priority: 1 }];
}
