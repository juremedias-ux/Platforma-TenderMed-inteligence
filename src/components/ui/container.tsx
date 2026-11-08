import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Page-width container with a 16px gutter on phones. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
