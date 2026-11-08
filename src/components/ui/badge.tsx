import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Small label. Status badges must always contain readable text (and
 * usually an icon) — colour is never the only signal.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-subtle text-ink-soft",
        accent: "border-accent-200 bg-accent-50 text-accent-800",
        success: "border-success-200 bg-success-50 text-success-700",
        warning: "border-warning-200 bg-warning-50 text-warning-700",
        danger: "border-danger-200 bg-danger-50 text-danger-700",
        info: "border-info-200 bg-info-50 text-info-700",
        navy: "border-navy-800 bg-navy-900 text-white",
        outline: "border-line-strong bg-surface text-ink-soft",
      },
      size: {
        sm: "px-2 py-1 text-[11px]",
        md: "px-2.5 py-1.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  size,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
