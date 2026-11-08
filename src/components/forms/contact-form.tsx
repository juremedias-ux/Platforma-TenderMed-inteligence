"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/form-controls";
import { LIMITS, contactMessageSchema, toFieldErrors, type FieldErrors } from "@/lib/validation/inquiry-schemas";
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
  message: string;
}

const emptyValues: Values = { fullName: "", email: "", message: "" };
const FIELD_ORDER = ["fullName", "email", "message"] as const;

export function ContactForm() {
  const id = useId();
  const fieldId = (name: string) => `${id}-${name}`;
  const [values, setValues] = useState<Values>(emptyValues);
  const [honeypot, setHoneypot] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const { status, errorMessage, serverFieldErrors, submit, reset } = useInquirySubmission("/api/contact");

  const errors: FieldErrors = { ...serverFieldErrors, ...clientErrors };
  const submitting = status === "submitting";
  const handleToken = useCallback((token: string) => setTurnstileToken(token), []);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (clientErrors[key]) {
      const result = contactMessageSchema.safeParse({ ...values, [key]: value });
      const next = result.success ? {} : toFieldErrors(result.error);
      setClientErrors((current) => ({ ...current, [key]: next[key] }));
    }
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = contactMessageSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors = toFieldErrors(result.error);
      setClientErrors(fieldErrors);
      const first = FIELD_ORDER.find((name) => fieldErrors[name]);
      if (first) formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(first))}`)?.focus();
      return;
    }
    setClientErrors({});
    const ok = await submit({ ...values, website: honeypot, turnstileToken });
    if (!ok) setTurnstileReset((n) => n + 1);
  }

  if (status === "success") {
    return (
      <SuccessPanel
        message="Hvala. Vaše sporočilo smo prejeli."
        onReset={() => {
          setValues(emptyValues);
          reset();
        }}
        resetLabel="Pošlji novo sporočilo"
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
      className="relative space-y-5"
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
      <div>
        <Label htmlFor={fieldId("message")}>
          Sporočilo
          <RequiredMark />
        </Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          rows={5}
          className="mt-2"
          maxLength={LIMITS.contactMessageMax}
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", `${fieldId("message")}-namig`)}
          aria-required="true"
        />
        <FieldError id={`${fieldId("message")}-napaka`}>{errors.message}</FieldError>
        <FieldHint id={`${fieldId("message")}-namig`} className="flex justify-end">
          <span aria-hidden="true" className="tabular-nums">
            {values.message.length}/{LIMITS.contactMessageMax}
          </span>
          <span className="sr-only">Največ {LIMITS.contactMessageMax} znakov.</span>
        </FieldHint>
      </div>

      <HoneypotField id={fieldId("website")} value={honeypot} onChange={setHoneypot} />
      <TurnstileWidget onToken={handleToken} resetSignal={turnstileReset} />

      <FormError message={errorMessage} />

      <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <PrivacyNote />
        <SubmitButton submitting={submitting} label="Pošlji sporočilo" />
      </div>
    </form>
  );
}
