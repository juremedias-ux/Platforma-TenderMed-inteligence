import type { Metadata } from "next";
import { ContactSection } from "@/components/marketing/contact-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { Hero } from "@/components/marketing/hero";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { InstitutionsSection } from "@/components/marketing/institutions-section";
import { ModulesSection } from "@/components/marketing/modules-section";
import { PartnersSection } from "@/components/marketing/partners-section";
import { PilotSection } from "@/components/marketing/pilot-section";
import { ProblemSection } from "@/components/marketing/problem-section";
import { RecommendationsSection } from "@/components/marketing/recommendations-section";
import { ServiceModelsSection } from "@/components/marketing/service-models-section";
import { buildPageMetadata } from "@/lib/config/seo";

export const metadata: Metadata = buildPageMetadata({ path: "/" });

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <InstitutionsSection />
      <HowItWorksSection />
      <ModulesSection />
      <RecommendationsSection />
      <PartnersSection />
      <ServiceModelsSection />
      <PilotSection />
      <FaqSection />
      <ContactSection />
    </>
  );
}
