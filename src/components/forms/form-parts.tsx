"use client";

import { CircleAlert, CircleCheck, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HONEYPOT_FIELD } from "@/lib/forms/inquiry-response";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

export const SENSITIVE_DATA_NOTICE =
  "V obrazec ne vpisujte zdravstvenih podatkov pacientov ali drugih občutljivih informacij.";

/** Visually hidden trap field. Real visitors (and screen readers) never encounter it. */
export function HoneypotField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden">
      <label htmlFor={id}>Spletna stran (pustite prazno)</label>
      <input
        id={id}
        name={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function SensitiveDataNotice() {
  return (
    <p className="flex items-start gap-2.5 rounded-md border border-warning-200 bg-warning-50 px-3.5 py-3 text-sm leading-relaxed text-warning-700">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {SENSITIVE_DATA_NOTICE}
    </p>
  );
}

export function PrivacyNote({
  text = "Podatke iz obrazca uporabimo samo za odgovor na vaše sporočilo.",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-[13px] leading-relaxed text-ink-muted", className)}>
      {text} Več o tem v{" "}
      <Link
        href="/zasebnost"
        className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
      >
        izjavi o zasebnosti
      </Link>
      .
    </p>
  );
}

export function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={submitting}
      aria-disabled={submitting}
      className="w-full sm:w-auto"
      data-submitting={submitting || undefined}
    >
      {submitting ? (
        <>
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Pošiljanje …
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/** Error announcement. role="alert" makes screen readers read it immediately. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-danger-200 bg-danger-50 px-3.5 py-3 text-sm leading-relaxed text-danger-700"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

/** Success state shown only after the server confirmed persistence. Receives focus for screen readers. */
export function SuccessPanel({
  message,
  onReset,
  resetLabel,
}: {
  message: string;
  onReset: () => void;
  resetLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="rounded-xl border border-success-200 bg-success-50 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-success-700/30"
    >
      <p className="flex items-start gap-3 text-base font-semibold text-success-700">
        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {message}
      </p>
      {siteConfig.inquiryResponseTimeText ? (
        <p className="mt-2 pl-8 text-sm text-success-700">{siteConfig.inquiryResponseTimeText}</p>
      ) : null}
      <Button variant="secondary" size="sm" className="mt-5 ml-8" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}

export function RequiredMark() {
  return (
    <span className="text-danger-700" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
