import { FilePenLine } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { formatLongDate } from "@/lib/dates/format";

/** Layout for editable legal drafts. Clearly marked as not yet legally reviewed. */
export function LegalPage({
  title,
  draftVersion,
  draftDate,
  children,
}: {
  title: string;
  draftVersion: string;
  draftDate: string;
  children: ReactNode;
}) {
  return (
    <article className="py-14 sm:py-20">
      <Container className="max-w-3xl">
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm leading-relaxed text-warning-700">
          <FilePenLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">Osnutek – besedilo še ni pravno pregledano.</strong> Pred javno objavo ga
            mora pregledati in potrditi upravljavec platforme oziroma pravni svetovalec. Manjkajoči podatki so označeni.
          </p>
        </div>
        <h1 className="mt-10 font-display text-4xl font-semibold tracking-[-0.02em] text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Različica osnutka: {draftVersion} · pripravljeno {formatLongDate(draftDate)}
        </p>
        <div className="legal-content mt-10 space-y-8 text-[15px] leading-relaxed text-ink-soft [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </Container>
    </article>
  );
}

/** Placeholder for information that must be supplied before launch. */
export function MissingInfo({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-xs border border-dashed border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[13px] font-medium text-warning-700">
      Manjka: {children}
    </span>
  );
}

export function ConfiguredOrMissing({ value, label }: { value: string | null; label: string }) {
  return value ? <>{value}</> : <MissingInfo>{label}</MissingInfo>;
}
