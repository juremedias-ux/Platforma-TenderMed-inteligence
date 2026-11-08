import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { siteConfig } from "@/lib/config/site";
import { isIndexingAllowed } from "@/lib/config/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-schibsted",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase is set only for a configured, real domain.
  ...(siteConfig.url ? { metadataBase: new URL(siteConfig.url) } : {}),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: isIndexingAllowed() ? { index: true, follow: true } : { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#faf9f6",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sl" className={`${inter.variable} ${schibsted.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh">
        <a
          href="#vsebina"
          className="sr-only z-[60] rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Preskoči na vsebino
        </a>
        {children}
      </body>
    </html>
  );
}
