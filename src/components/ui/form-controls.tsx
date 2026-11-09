import type { ComponentProps, LabelHTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Native form controls with consistent styling and accessible error states. */

const controlBase = [
  "w-full rounded-md border bg-surface text-[15px] text-ink shadow-card",
  "placeholder:text-ink-muted/80 transition-colors duration-150",
  "focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20",
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted",
  "aria-[invalid=true]:border-danger-700 aria-[invalid=true]:focus:ring-danger-700/15",
].join(" ");

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-medium text-ink", className)} {...props}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-11 border-line-strong px-3.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "min-h-28 resize-y border-line-strong px-3.5 py-3 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        controlBase,
        "select-chevron h-10 cursor-pointer appearance-none border-line-strong pr-9 pl-3 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm text-danger-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FieldHint({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("mt-2 text-[13px] leading-relaxed text-ink-muted", className)}>
      {children}
    </p>
  );
}
