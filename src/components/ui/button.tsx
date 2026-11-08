import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-colors duration-150 ease-[var(--ease-calm)]",
    "disabled:pointer-events-none disabled:opacity-55",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-white shadow-card hover:bg-navy-800 active:bg-navy-950",
        secondary: "border border-line-strong bg-surface text-ink shadow-card hover:border-navy-300 hover:bg-subtle",
        accent: "bg-accent-600 text-white shadow-card hover:bg-accent-700",
        ghost: "text-ink-soft hover:bg-subtle hover:text-ink",
        subtle: "bg-subtle text-ink hover:bg-muted",
        inverse: "bg-white text-navy-900 hover:bg-accent-50",
        "inverse-outline": "border border-white/25 text-white hover:border-white/50 hover:bg-white/5",
        danger: "border border-danger-200 bg-surface text-danger-700 hover:bg-danger-50",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-[13px]",
        md: "h-10 rounded-md px-4 text-sm",
        lg: "h-12 rounded-md px-5 text-[15px]",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
