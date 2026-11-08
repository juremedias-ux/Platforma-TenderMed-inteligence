/** Primary navigation (homepage anchors). Absolute paths keep links working from sub-pages. */
export const primaryNavigation = [
  { href: "/#za-ustanove", label: "Za ustanove" },
  { href: "/#kako-deluje", label: "Kako deluje" },
  { href: "/#funkcionalnosti", label: "Funkcionalnosti" },
  { href: "/#za-partnerje", label: "Za partnerje" },
  { href: "/#kontakt", label: "Kontakt" },
] as const;

export const primaryActions = {
  demo: { href: "/demo", label: "Oglejte si demo" },
  pilot: { href: "/#pilot", label: "Prijavite interes za pilot" },
} as const;

export const legalNavigation = [
  { href: "/zasebnost", label: "Zasebnost" },
  { href: "/pogoji", label: "Pogoji uporabe" },
] as const;
