"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { primaryActions, primaryNavigation } from "@/data/marketing/navigation";
import { cn } from "@/lib/utils/cn";
import { BrandWordmark } from "./brand";

/**
 * Mobile menu as a modal dialog: focus moves into the panel, is trapped
 * while open, Escape closes it, and focus returns to the menu button.
 */
export function MobileNavigation() {
  const [open, setOpen] = useState(false);

  // Close when the page is hidden by client-side navigation (Activity).
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")}
        aria-label="Odpri meni"
      >
        <Menu aria-hidden="true" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-950/40 animate-fade-in lg:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto border-b border-line bg-canvas shadow-overlay animate-fade-in focus:outline-none lg:hidden"
          aria-describedby={undefined}
        >
          <div className="flex h-[4.5rem] items-center justify-between px-4 sm:px-6">
            <BrandWordmark />
            <DialogPrimitive.Close
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Zapri meni"
            >
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="sr-only">Meni</DialogPrimitive.Title>
          <nav aria-label="Mobilna navigacija" className="px-4 pb-6 sm:px-6">
            <ul className="divide-y divide-line border-y border-line">
              {primaryNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-4 text-base font-medium text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3">
              <Link
                href={primaryActions.demo.href}
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                {primaryActions.demo.label}
              </Link>
              <Link
                href={primaryActions.pilot.href}
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                {primaryActions.pilot.label}
              </Link>
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
