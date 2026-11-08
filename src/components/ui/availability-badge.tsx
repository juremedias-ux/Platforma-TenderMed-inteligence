import { CircleDashed, MousePointerClick, Wrench } from "lucide-react";
import { featureAvailabilityLabels, type FeatureAvailability } from "@/lib/config/site";
import { Badge } from "./badge";

const icons = {
  interactive_demo: MousePointerClick,
  in_development: Wrench,
  planned: CircleDashed,
} as const;

const tones = {
  interactive_demo: "accent",
  in_development: "info",
  planned: "outline",
} as const;

/** Availability label for platform modules. Never says "Na voljo" for demo-only features. */
export function AvailabilityBadge({ availability }: { availability: FeatureAvailability }) {
  const Icon = icons[availability];
  return (
    <Badge tone={tones[availability]}>
      <Icon aria-hidden="true" />
      {featureAvailabilityLabels[availability]}
    </Badge>
  );
}
