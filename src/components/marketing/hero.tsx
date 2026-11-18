import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PilotSignupForm } from "@/components/forms/pilot-signup-form";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { hero } from "@/data/marketing/home";
import { primaryActions } from "@/data/marketing/navigation";
import { getCachedDemoSnapshot } from "@/features/demo/cached-snapshot";
import { ProductPreview } from "./product-preview";

const delay = (ms: number) => ({ "--hero-delay": `${ms}ms` }) as CSSProperties;

export async function Hero() {
  const snapshot = await getCachedDemoSnapshot();
  const lead = hero.title.slice(0, hero.title.length - hero.titleAccent.length).trimEnd();

  return (
    <section
      aria-labelledby="hero-naslov"
      className="relative isolate overflow-x-clip border-b border-line bg-canvas text-ink"
    >
      <div aria-hidden="true" className="hero-aura pointer-events-none absolute inset-[-10%] -z-10" />
      <Container className="pt-16 pb-6 sm:pt-24 lg:pt-28">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p
            className="motion-hero-in inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold text-accent-800"
            style={delay(0)}
          >
            <span className="size-1.5 rounded-full bg-accent-600" aria-hidden="true" />
            {hero.eyebrow}
          </p>
          <h1
            id="hero-naslov"
            className="motion-hero-in mt-7 font-display text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-6xl lg:text-[5.25rem]"
            style={delay(120)}
          >
            {lead} <span className="text-gradient">{hero.titleAccent}</span>
          </h1>
          <p
            className="motion-hero-in mt-7 max-w-2xl text-lg leading-relaxed text-pretty text-ink-soft sm:text-xl"
            style={delay(240)}
          >
            {hero.text}
          </p>
          <div
            id="prijava"
            className="motion-hero-in mt-10 w-full max-w-lg rounded-2xl border border-line bg-surface p-4 text-left shadow-raised sm:p-5"
            style={delay(360)}
          >
            <p className="text-base font-semibold text-ink">{hero.signupTitle}</p>
            <PilotSignupForm className="mt-3" />
          </div>
          <div className="motion-hero-in mt-6" style={delay(480)}>
            <Link href={primaryActions.demo.href} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {hero.primaryCta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <p
            className="motion-hero-in mt-6 flex max-w-md items-start gap-2 text-left text-sm leading-relaxed text-ink-muted"
            style={delay(560)}
          >
            <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
            {hero.status}
          </p>
        </div>
      </Container>

      <Container className="relative pb-20 sm:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[8%] top-[18%] -z-10 h-[60%] rounded-full bg-accent-200/50 blur-[90px]"
        />
        <div className="motion-settle mx-auto mt-14 max-w-6xl">
          <ProductPreview snapshot={snapshot} />
        </div>
      </Container>
    </section>
  );
}
