"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { FieldError, Input, Label } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils/cn";
import { LIMITS, demoRequestSchema, toFieldErrors, type FieldErrors } from "@/lib/validation/inquiry-schemas";
import { FormError, HoneypotField, PrivacyNote, SubmitButton, SuccessPanel } from "./form-parts";
import { TurnstileWidget } from "./turnstile-widget";
import { useInquirySubmission } from "./use-inquiry-submission";

export const PILOT_SIGNUP_SUCCESS = "Hvala za vaše zanimanje. Vaše povpraševanje smo prejeli.";

/**
 * Pilot sign-up with a single required field: the e-mail address.
 * Used at the top of the homepage (hero) and in the pilot section.
 */
export function PilotSignupForm({ className }: { className?: string }) {
  const id = useId();
  const inputId = `${id}-email`;
  const errorId = `${inputId}-napaka`;
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, errorMessage, serverFieldErrors, submit, reset } = useInquirySubmission("/api/demo-request");

  const error = clientErrors.email ?? serverFieldErrors.email;
  const submitting = status === "submitting";
  const handleToken = useCallback((token: string) => setTurnstileToken(token), []);

  function onChange(value: string) {
    setEmail(value);
    if (clientErrors.email) {
      const result = demoRequestSchema.safeParse({ email: value });
      setClientErrors(result.success ? {} : toFieldErrors(result.error));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = demoRequestSchema.safeParse({ email });
    if (!result.success) {
      setClientErrors(toFieldErrors(result.error));
      inputRef.current?.focus();
      return;
    }
    setClientErrors({});
    const ok = await submit({ email, website: honeypot, turnstileToken });
    if (!ok) setTurnstileReset((n) => n + 1);
  }

  if (status === "success") {
    return (
      <div className={className}>
        <SuccessPanel
          message={PILOT_SIGNUP_SUCCESS}
          onReset={() => {
            setEmail("");
            reset();
          }}
          resetLabel="Prijavite drug e-poštni naslov"
        />
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className={cn("relative space-y-3", className)}
      aria-label="Prijava interesa za pilot"
    >
      <Label htmlFor={inputId}>
        E-poštni naslov
        <span className="sr-only"> (obvezno)</span>
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Input
            ref={inputRef}
            id={inputId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ime@organizacija.si"
            maxLength={LIMITS.emailMax}
            value={email}
            onChange={(e) => onChange(e.target.value)}
            className="h-12"
            aria-required="true"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
          <FieldError id={errorId}>{error}</FieldError>
        </div>
        <SubmitButton submitting={submitting} label="Prijavite interes" />
      </div>

      <HoneypotField id={`${id}-website`} value={honeypot} onChange={setHoneypot} />
      <TurnstileWidget onToken={handleToken} resetSignal={turnstileReset} />

      <FormError message={errorMessage} />
      <PrivacyNote text="E-poštni naslov uporabimo samo za odgovor glede pilota." />
    </form>
  );
}
