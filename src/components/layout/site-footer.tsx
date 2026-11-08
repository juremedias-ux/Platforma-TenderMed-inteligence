import { cacheLife } from "next/cache";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { footer } from "@/data/marketing/home";
import { legalNavigation, primaryActions, primaryNavigation } from "@/data/marketing/navigation";
import { siteConfig } from "@/lib/config/site";
import { DEMO_TIME_ZONE } from "@/lib/dates/reference-date";
import { BrandWordmark } from "./brand";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  const year = new Intl.DateTimeFormat("sl-SI", { year: "numeric", timeZone: DEMO_TIME_ZONE }).format(new Date());
  return <>{year}</>;
}

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-navy-200">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-md">
            <BrandWordmark inverse />
            <p className="mt-5 text-sm leading-relaxed text-navy-300">{footer.description}</p>
            <p className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs text-navy-200">
              {footer.stage}
            </p>
          </div>

          <nav aria-label="Navigacija v nogi">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">Platforma</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {primaryNavigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={primaryActions.demo.href} className="transition-colors hover:text-white">
                  Interaktivni demo
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">Pravno</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {legalNavigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              {siteConfig.medcoreUrl ? (
                <li>
                  <a
                    href={siteConfig.medcoreUrl}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
                    rel="noopener"
                  >
                    Medcore – distribucija opreme
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="max-w-4xl text-xs leading-relaxed text-navy-300">{footer.disclaimer}</p>
          <p className="mt-6 text-xs text-navy-300">
            © <CopyrightYear /> {siteConfig.name}
          </p>
        </div>
      </Container>
    </footer>
  );
}
