import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Aplikacija", template: "%s | TenderMed" },
  robots: { index: false, follow: false },
};

/** Authenticated application. Access control happens in every page and action, not here. */
export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f2f3f1]">{children}</div>;
}
