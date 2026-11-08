"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Accessible dialog primitives (Radix): focus is trapped while open,
 * Escape closes, and focus returns to the trigger on close.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-[1px] animate-fade-in", className)}
    />
  );
}

function CloseButton({ label = "Zapri" }: { label?: string }) {
  return (
    <DialogPrimitive.Close
      className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
      aria-label={label}
    >
      <X className="size-4" aria-hidden="true" />
    </DialogPrimitive.Close>
  );
}

interface ContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  children: ReactNode;
  closeLabel?: string;
}

/**
 * Dialogs opened programmatically (without a Radix trigger) would otherwise
 * drop focus to <body> on close. This remembers the element that had focus
 * when the dialog opened and restores it when the dialog closes.
 */
function useFocusReturn(
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"],
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"],
) {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const target = previous.current;
      if (target && target.isConnected && target !== document.body) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}

/** Centered modal dialog. */
export function DialogContent({
  className,
  children,
  closeLabel,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ContentProps) {
  const focusReturn = useFocusReturn(onOpenAutoFocus, onCloseAutoFocus);
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
          "rounded-xl border border-line bg-surface p-6 shadow-overlay animate-scale-in focus:outline-none sm:p-7",
          className,
        )}
        {...props}
        {...focusReturn}
      >
        {children}
        <CloseButton label={closeLabel} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Side sheet (drawer) used for detail views. */
export function SheetContent({
  className,
  children,
  closeLabel,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ContentProps) {
  const focusReturn = useFocusReturn(onOpenAutoFocus, onCloseAutoFocus);
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-surface shadow-overlay",
          "animate-slide-in-right focus:outline-none",
          className,
        )}
        {...props}
        {...focusReturn}
      >
        {children}
        <CloseButton label={closeLabel} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("pr-10 font-display text-xl font-semibold tracking-[-0.01em] text-ink", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn("mt-2 text-sm leading-relaxed text-ink-soft", className)} {...props} />
  );
}
