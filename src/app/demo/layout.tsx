import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";
import { DEMO_NOTICE } from "@/data/demo/notices";
import { primaryActions } from "@/data/marketing/navigation";
import { cn } from "@/lib/utils/cn";

/** Application-style shell for the demo, visually distinct from the marketing pages. */
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <div className="min-h-dvh bg-[#f2f3f1]">
      <header className="sticky top-0 z-40">
        <div className="bg-navy-950 text-white">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 rounded-md"
                aria-label="TenderMed Intelligence – domov"
              >
                <BrandMark inverse className="size-7" />
                <span className="hidden font-display text-[15px] font-semibold sm:inline">TenderMed</span>
              </Link>
              <span className="h-5 w-px bg-white/15" aria-hidden="true" />
              <h1 className="truncate text-sm font-medium text-navy-200">Interaktivni demo</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "inverse-outline", size: "sm" }), "hidden md:inline-flex")}
              >
                <ArrowLeft aria-hidden="true" />
                Nazaj na predstavitev
              </Link>
              <Link href={primaryActions.pilot.href} className={buttonVariants({ variant: "inverse", size: "sm" })}>
                <span className="sm:hidden" aria-hidden="true">
                  Pilot
                </span>
                <span className="sr-only sm:not-sr-only">{primaryActions.pilot.label}</span>
              </Link>
            </div>
          </div>
        </div>
        <div role="note" aria-label="Opozorilo o demonstraciji" className="border-b border-warning-200 bg-warning-50">
          <p className="mx-auto flex max-w-[1440px] items-start gap-2 px-4 py-2 text-[13px] leading-snug font-medium text-warning-700 sm:px-6 lg:items-center lg:px-8">
            <ShieldAlert className="mt-px size-4 shrink-0 lg:mt-0" aria-hidden="true" />
            {DEMO_NOTICE}
          </p>
        </div>
      </header>
      <main id="vsebina" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </div>
  );
}
