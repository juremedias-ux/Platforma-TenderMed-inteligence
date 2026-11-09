import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PilotSignupForm } from "@/components/forms/pilot-signup-form";
import { Container } from "@/components/ui/container";
import { hero } from "@/data/marketing/home";
import { primaryActions } from "@/data/marketing/navigation";
import { getCachedDemoSnapshot } from "@/features/demo/cached-snapshot";
import { ProductPreview } from "./product-preview";

export async function Hero() {
  const snapshot = await getCachedDemoSnapshot();

  return (
    <section aria-labelledby="hero-naslov" className="relative overflow-hidden border-b border-line">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <Container className="relative grid items-center gap-14 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:pt-24 lg:pb-28">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-800">
            <span className="size-1.5 rounded-full bg-accent-600" aria-hidden="true" />
            {hero.eyebrow}
          </p>
          <h1
            id="hero-naslov"
            className="mt-6 font-display text-[2.35rem] leading-[1.06] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-5xl lg:text-[3.5rem]"
          >
            {hero.title}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-pretty text-ink-soft">{hero.text}</p>
          <div id="prijava" className="mt-9 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
            <p className="text-base font-semibold text-ink">{hero.signupTitle}</p>
            <PilotSignupForm className="mt-3" />
          </div>
          <div className="mt-5">
            <Link href={primaryActions.demo.href} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {hero.primaryCta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-6 flex max-w-md items-start gap-2 text-sm leading-relaxed text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
            {hero.status}
          </p>
        </div>

        <div className="min-w-0">
          <ProductPreview snapshot={snapshot} />
        </div>
      </Container>
    </section>
  );
}
