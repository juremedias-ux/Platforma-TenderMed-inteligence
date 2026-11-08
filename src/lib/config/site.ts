/**
 * Central public site configuration.
 *
 * Values that are not yet known are explicit `null` placeholders. Components
 * hide anything that is not configured: no invented domain, e-mail address,
 * phone number, legal entity or office address is ever rendered.
 * See "Launch checklist" in README.md.
 */

export type FeatureAvailability = "interactive_demo" | "in_development" | "planned";

export const featureAvailabilityLabels: Record<FeatureAvailability, string> = {
  interactive_demo: "Interaktivni demo",
  in_development: "V razvoju",
  planned: "Načrtovano",
};

function normalizeSiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const siteConfig = {
  name: "TenderMed Intelligence",
  shortName: "TenderMed",
  description:
    "Spoznajte platformo v razvoju za evidenco medicinske opreme, servisno usklajevanje in pregled relevantnih rešitev. Oglejte si interaktivni demo.",
  title: "TenderMed Intelligence | Oprema, servisi in premišljene nabave",
  locale: "sl_SI",

  /** Canonical origin, e.g. https://www.example.si. Null until a real domain is configured. */
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),

  /** Public contact details. Null values are not rendered. */
  contact: {
    email: null as string | null,
    phone: null as string | null,
    address: null as string | null,
  },

  /** Legal operator details for the privacy notice and terms. */
  legalOperator: {
    name: null as string | null,
    registrationNumber: null as string | null,
    address: null as string | null,
    privacyContactEmail: null as string | null,
  },

  /** Optional link to the separate Medcore distribution website. */
  medcoreUrl: null as string | null,

  social: {
    linkedin: null as string | null,
  },

  /** Configurable response-time promise for inquiries. Null = no promise is shown. */
  inquiryResponseTimeText: null as string | null,

  /** Versions recorded with each inquiry (update when the texts change). */
  privacyNoticeVersion: "2026-11-osnutek-1",
  marketingConsentVersion: "2026-11-v1",
} as const;

export type SiteConfig = typeof siteConfig;
