import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Restrained typographic mark: a "T" with a teal node marking connected records. */
export function BrandMark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  const fg = inverse ? "#0c1a2c" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill={inverse ? "#ffffff" : "#0c1a2c"} />
      <path d="M9 10h14" stroke={fg} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M16 10v13" stroke={fg} strokeWidth="3.2" strokeLinecap="round" />
      <rect x="20.5" y="19.5" width="5" height="5" rx="1.4" fill="#2fa491" />
    </svg>
  );
}

export function BrandWordmark({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5 rounded-md", className)}
      aria-label="TenderMed Intelligence – domov"
    >
      <BrandMark inverse={inverse} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[17px] font-semibold tracking-[-0.01em]",
            inverse ? "text-white" : "text-ink",
          )}
        >
          TenderMed
        </span>
        <span
          className={cn(
            "mt-1 text-[10.5px] font-medium uppercase tracking-[0.2em]",
            inverse ? "text-navy-300" : "text-ink-muted",
          )}
        >
          Intelligence
        </span>
      </span>
    </Link>
  );
}
