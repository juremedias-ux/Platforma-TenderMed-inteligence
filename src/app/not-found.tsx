import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Stran ne obstaja",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="vsebina" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <BrandWordmark />
      <p className="mt-12 font-mono text-sm text-ink-muted">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">Strani ni mogoče najti</h1>
      <p className="mt-4 max-w-md text-ink-soft">
        Povezava je morda napačna ali pa stran ne obstaja več. Nadaljujte na začetni strani ali si oglejte interaktivni
        demo.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Na začetno stran
        </Link>
        <Link href="/demo" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Oglejte si demo
        </Link>
      </div>
    </main>
  );
}
