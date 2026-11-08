"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils/cn";
import {
  LIMITS,
  demoRequestSchema,
  interestAreaLabels,
  interestAreas,
  toFieldErrors,
  type FieldErrors,
  type InterestArea,
} from "@/lib/validation/inquiry-schemas";
import {
  FormError,
  HoneypotField,
  PrivacyNote,
  RequiredMark,
  SensitiveDataNotice,
  SubmitButton,
  SuccessPanel,
} from "./form-parts";
import { TurnstileWidget } from "./turnstile-widget";
import { useInquirySubmission } from "./use-inquiry-submission";

interface Values {
  fullName: string;
  email: string;
  interestArea: InterestArea | "";
  message: string;
  marketingOptIn: boolean;
}

const emptyValues: Values = { fullName: "", email: "", interestArea: "", message: "", marketingOptIn: false };
const FIELD_ORDER = ["fullName", "email", "interestArea", "message"] as const;

export function PilotInquiryForm() {
  const id = useId();
  const fieldId = (name: string) => `${id}-${name}`;
  const [values, setValues] = useState<Values>(emptyValues);
  const [honeypot, setHoneypot] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const { status, errorMessage, serverFieldErrors, submit, reset } = useInquirySubmission("/api/demo-request");

  const errors: FieldErrors = { ...serverFieldErrors, ...clientErrors };
  const submitting = status === "submitting";

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (clientErrors[key]) {
      const result = demoRequestSchema.safeParse({ ...values, [key]: value });
      const next = result.success ? {} : toFieldErrors(result.error);
      setClientErrors((current) => ({ ...current, [key]: next[key] }));
    }
  };

  const focusFirstError = (fieldErrors: FieldErrors) => {
    const first = FIELD_ORDER.find((name) => fieldErrors[name]);
    if (!first) return;
    const selector = first === "interestArea" ? `[name="interestArea"]` : `#${CSS.escape(fieldId(first))}`;
    formRef.current?.querySelector<HTMLElement>(selector)?.focus();
  };

  const handleToken = useCallback((token: string) => setTurnstileToken(token), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = demoRequestSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors = toFieldErrors(result.error);
      setClientErrors(fieldErrors);
      focusFirstError(fieldErrors);
      return;
    }
    setClientErrors({});
    const ok = await submit({ ...values, website: honeypot, turnstileToken });
    if (!ok) setTurnstileReset((n) => n + 1);
  }

  function startOver() {
    setValues(emptyValues);
    setClientErrors({});
    reset();
  }

  if (status === "success") {
    return (
      <SuccessPanel
        message="Hvala za vaše zanimanje. Vaše povpraševanje smo prejeli."
        onReset={startOver}
        resetLabel="Pošlji novo povpraševanje"
      />
    );
  }

  const describedBy = (name: string, hint?: string) =>
    [errors[name] ? `${fieldId(name)}-napaka` : null, hint].filter(Boolean).join(" ") || undefined;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="relative space-y-6"
      aria-describedby={`${id}-opozorilo`}
    >
      <div id={`${id}-opozorilo`}>
        <SensitiveDataNotice />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={fieldId("fullName")}>
            Ime in priimek
            <RequiredMark />
          </Label>
          <Input
            id={fieldId("fullName")}
            name="fullName"
            autoComplete="name"
            className="mt-2"
            maxLength={LIMITS.fullNameMax}
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={describedBy("fullName")}
            aria-required="true"
          />
          <FieldError id={`${fieldId("fullName")}-napaka`}>{errors.fullName}</FieldError>
        </div>
        <div>
          <Label htmlFor={fieldId("email")}>
            E-poštni naslov
            <RequiredMark />
          </Label>
          <Input
            id={fieldId("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="mt-2"
            maxLength={LIMITS.emailMax}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email")}
            aria-required="true"
          />
          <FieldError id={`${fieldId("email")}-napaka`}>{errors.email}</FieldError>
        </div>
      </div>

      <fieldset aria-describedby={errors.interestArea ? `${fieldId("interestArea")}-napaka` : undefined}>
        <legend className="text-sm font-medium text-ink">
          Kaj vas najbolj zanima?
          <RequiredMark />
          <span className="sr-only"> (obvezno)</span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {interestAreas.map((area) => {
            const checked = values.interestArea === area;
            return (
              <label
                key={area}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border bg-surface px-3.5 py-3 text-sm transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-600/30",
                  checked
                    ? "border-accent-600 bg-accent-50 text-ink"
                    : "border-line-strong text-ink-soft hover:border-navy-300",
                  errors.interestArea && !checked && "border-danger-200",
                )}
              >
                <input
                  type="radio"
                  name="interestArea"
                  value={area}
                  checked={checked}
                  onChange={() => update("interestArea", area)}
                  className="size-4 accent-[var(--color-accent-600)]"
                />
                {interestAreaLabels[area]}
              </label>
            );
          })}
        </div>
        <FieldError id={`${fieldId("interestArea")}-napaka`}>{errors.interestArea}</FieldError>
      </fieldset>

      <div>
        <Label htmlFor={fieldId("message")}>
          Kateri izziv želite rešiti? <span className="font-normal text-ink-muted">(neobvezno)</span>
        </Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          rows={4}
          className="mt-2"
          maxLength={LIMITS.demoMessageMax}
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", `${fieldId("message")}-namig`)}
        />
        <FieldError id={`${fieldId("message")}-napaka`}>{errors.message}</FieldError>
        <FieldHint id={`${fieldId("message")}-namig`} className="flex justify-between gap-4">
          <span>Opišite proces, ne konkretnih pacientov ali zaupnih podatkov.</span>
          <span aria-hidden="true" className="shrink-0 tabular-nums">
            {values.message.length}/{LIMITS.demoMessageMax}
          </span>
        </FieldHint>
      </div>

      <div className="flex items-start gap-3">
        <input
          id={fieldId("marketingOptIn")}
          type="checkbox"
          name="marketingOptIn"
          checked={values.marketingOptIn}
          onChange={(e) => update("marketingOptIn", e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent-600)]"
        />
        <label htmlFor={fieldId("marketingOptIn")} className="text-sm leading-relaxed text-ink-soft">
          Želim občasno prejemati obvestila o razvoju platforme TenderMed Intelligence (neobvezno). Soglasje lahko kadar
          koli prekličem.
        </label>
      </div>

      <HoneypotField id={fieldId("website")} value={honeypot} onChange={setHoneypot} />
      <TurnstileWidget onToken={handleToken} resetSignal={turnstileReset} />

      <FormError message={errorMessage} />

      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <PrivacyNote withMarketing />
        <SubmitButton submitting={submitting} label="Pošlji povpraševanje" />
      </div>
    </form>
  );
}
