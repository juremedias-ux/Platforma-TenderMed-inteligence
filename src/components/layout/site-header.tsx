import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/cn";
import { primaryActions, primaryNavigation } from "@/data/marketing/navigation";
import { BrandWordmark } from "./brand";
import { MobileNavigation } from "./mobile-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/80">
      <Container className="flex h-[4.5rem] items-center justify-between gap-6">
        <BrandWordmark />

        <nav aria-label="Glavna navigacija" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primaryNavigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-ink-soft transition-colors hover:bg-subtle hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={primaryActions.demo.href}
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "hidden xl:inline-flex")}
          >
            {primaryActions.demo.label}
          </Link>
          <Link href={primaryActions.pilot.href} className={buttonVariants({ variant: "primary", size: "md" })}>
            {primaryActions.pilot.label}
          </Link>
        </div>

        <MobileNavigation />
      </Container>
    </header>
  );
}
