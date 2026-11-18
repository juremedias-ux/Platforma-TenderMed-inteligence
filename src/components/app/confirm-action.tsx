"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonVariantProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Button that asks for confirmation in an accessible dialog before running a Server Action. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "danger",
  size = "sm",
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<{ status: string; message?: string } | void>;
} & ButtonVariantProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        {open ? (
          <DialogContent closeLabel="Prekliči">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
            {error ? (
              <p role="alert" className="mt-4 text-sm text-danger-700">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Prekliči
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await onConfirm();
                    if (result && result.status === "error") setError(result.message ?? "Dejanje ni uspelo.");
                    else setOpen(false);
                  })
                }
              >
                {pending ? "Izvajam …" : confirmLabel}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
