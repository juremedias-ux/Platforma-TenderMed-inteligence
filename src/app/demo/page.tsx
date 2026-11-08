import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DemoWorkspace } from "@/components/demo/demo-workspace";
import { buildPageMetadata } from "@/lib/config/seo";
import { getDemoReferenceDate } from "@/lib/dates/reference-date";
import { loadDemoSnapshot } from "@/features/demo/snapshot";
import { parseDemoView } from "@/features/demo/views";

export const metadata: Metadata = buildPageMetadata({
  title: "Interaktivni demo",
  description:
    "Interaktivni prikaz predvidenih delovnih tokov TenderMed Intelligence z izmišljenimi podatki: oprema, servisi, priporočila in ponazoritveni razpisi.",
  path: "/demo",
  noindex: true,
});

/**
 * The demo dataset is computed per request from the current Ljubljana date,
 * so relative deadlines stay meaningful after deployment.
 */
async function DemoLoader({ searchParams }: { searchParams: PageProps<"/demo">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const snapshot = await loadDemoSnapshot(getDemoReferenceDate());
  return <DemoWorkspace snapshot={snapshot} initialView={parseDemoView(params.pogled)} />;
}

function DemoLoading() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <p className="text-sm text-ink-muted" role="status">
        Nalagam demonstracijo …
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-line bg-surface motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-line bg-surface motion-reduce:animate-none" />
    </div>
  );
}

export default function DemoPage({ searchParams }: PageProps<"/demo">) {
  return (
    <Suspense fallback={<DemoLoading />}>
      <DemoLoader searchParams={searchParams} />
    </Suspense>
  );
}
