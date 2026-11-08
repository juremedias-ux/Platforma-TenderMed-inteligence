import type { Metadata } from "next";
import { siteConfig } from "./site";

/**
 * Pages may be indexed only when a real site URL is configured and, on
 * Vercel, only in the production environment (previews stay noindex).
 * `noindex` and robots.txt are not security controls.
 */
export function isIndexingAllowed(): boolean {
  if (!siteConfig.url) return false;
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv ? vercelEnv === "production" : true;
}

interface PageMetadataOptions {
  title?: string;
  description?: string;
  path: string;
  /** Force noindex (demo and draft legal pages). */
  noindex?: boolean;
}

export function buildPageMetadata({ title, description, path, noindex = false }: PageMetadataOptions): Metadata {
  const index = !noindex && isIndexingAllowed();
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    // Canonical URLs only when a real domain is configured — never a placeholder.
    ...(siteConfig.url ? { alternates: { canonical: path } } : {}),
    openGraph: {
      ...(title ? { title: `${title} | ${siteConfig.name}` } : {}),
      ...(description ? { description } : {}),
      ...(siteConfig.url ? { url: path } : {}),
    },
    robots: index ? { index: true, follow: true } : { index: false, follow: isIndexingAllowed() },
  };
}
