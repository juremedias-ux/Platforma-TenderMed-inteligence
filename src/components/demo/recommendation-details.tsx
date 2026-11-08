import { CircleHelp, FileCheck2, FileQuestion, Handshake, Puzzle, Scale, Target } from "lucide-react";
import type { ReactNode } from "react";
import { compatibilityStatusLabels, commercialDisclosure } from "@/features/recommendations/labels";
import { REPLACEMENT_STATEMENT } from "@/features/recommendations/rules";
import { cn } from "@/lib/utils/cn";
import type { MatchExplanation } from "@/types/domain";

/**
 * Explanation blocks for one recommendation, shared by the homepage example
 * and the interactive demo. Pure presentational component (no hooks).
 */

function Block({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: typeof Target;
  title: string;
  children: ReactNode;
  tone?: "default" | "warning" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "default" && "border-line bg-surface",
        tone === "warning" && "border-warning-200 bg-warning-50/60",
        tone === "muted" && "border-line bg-subtle",
      )}
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon className="size-4 text-ink-soft" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export function RecommendationDetails({
  explanation,
  showEvidence = true,
  compact = false,
}: {
  explanation: MatchExplanation;
  showEvidence?: boolean;
  compact?: boolean;
}) {
  const disclosure = commercialDisclosure[explanation.commercialRelationship];
  const openChecks = explanation.compatibility.details.filter((d) => d.status !== "confirmed");

  return (
    <div className={cn("grid gap-3", !compact && "md:grid-cols-2")}>
      <Block icon={Target} title="Zakaj je predlog relevanten">
        <ul className="list-disc space-y-1 pl-4">
          {explanation.relevance.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {explanation.replacement?.applies ? (
          <div className="mt-3 rounded-md border border-line bg-subtle p-3">
            <p className="flex items-center gap-1.5 font-medium text-ink">
              <Scale className="size-4" aria-hidden="true" />
              {REPLACEMENT_STATEMENT}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {explanation.replacement.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-ink-muted">{explanation.replacement.caveat}</p>
          </div>
        ) : null}
      </Block>

      <Block icon={Puzzle} title="Kaj je treba preveriti">
        <p>
          <span className="font-medium text-ink">Združljivost: </span>
          {compatibilityStatusLabels[explanation.compatibility.status]}
        </p>
        {openChecks.length > 0 ? (
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {openChecks.map((check) => (
              <li key={check.target}>
                {check.target} – {compatibilityStatusLabels[check.status].toLowerCase()}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2">
          <span className="font-medium text-ink">Predlagani naslednji korak: </span>
          {explanation.suggestedNextStep}
        </p>
      </Block>

      {showEvidence ? (
        <Block icon={FileCheck2} title="Razpoložljivi dokazi">
          {explanation.evidence.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4">
              {explanation.evidence.map((item) => (
                <li key={item.label}>{item.label}</li>
              ))}
            </ul>
          ) : (
            <p>Ni zabeleženih dokazov.</p>
          )}
        </Block>
      ) : null}

      <Block
        icon={explanation.missingInformation.length > 0 ? FileQuestion : CircleHelp}
        title="Podatki, ki manjkajo"
        tone={explanation.missingInformation.length > 0 ? "warning" : "default"}
      >
        {explanation.missingInformation.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4">
            {explanation.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>Za ta predlog ni zabeleženih manjkajočih podatkov.</p>
        )}
      </Block>

      <Block icon={Handshake} title="Komercialna povezava ponudnika" tone="muted">
        <p className="font-medium text-ink">{disclosure.label}</p>
        <p className="mt-1">{disclosure.text}</p>
      </Block>
    </div>
  );
}
