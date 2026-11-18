"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariantProps } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import type { ActionState } from "@/lib/forms/action-state";
import { cn } from "@/lib/utils/cn";

/** Submit button that is disabled while its form is pending (duplicate-submit protection). */
export function SubmitButton({
  children,
  pendingLabel = "Shranjujem …",
  className,
  variant,
  size,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
} & ButtonVariantProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={className}
      variant={variant}
      size={size}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Announces the result of a Server Action. Errors use role="alert". */
export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const error = state.status === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm leading-relaxed",
        error ? "border-danger-200 bg-danger-50 text-danger-700" : "border-success-200 bg-success-50 text-success-700",
      )}
    >
      {error ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <p>{state.message}</p>
    </div>
  );
}

export function TextField({
  name,
  label,
  state,
  type = "text",
  autoComplete,
  required,
  defaultValue,
  hint,
  maxLength,
  inputMode,
  idPrefix = "field",
}: {
  name: string;
  label: string;
  state: ActionState;
  idPrefix?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  maxLength?: number;
  inputMode?: "email" | "text" | "numeric" | "decimal";
}) {
  const id = `${idPrefix}-${name}`;
  const error = state.fieldErrors?.[name];
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="sr-only"> (obvezno)</span> : null}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-required={required || undefined}
        defaultValue={state.values?.[name] ?? defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        maxLength={maxLength}
        inputMode={inputMode}
        className="mt-1.5"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
}

export function SelectField({
  name,
  label,
  state,
  options,
  defaultValue,
  required,
  hint,
  placeholder,
  idPrefix = "field",
}: {
  name: string;
  label: string;
  state: ActionState;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  /** Adds an empty first option with this label. */
  placeholder?: string;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${name}`;
  const error = state.fieldErrors?.[name];
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="sr-only"> (obvezno)</span> : null}
      </Label>
      <Select
        id={id}
        name={name}
        required={required}
        aria-required={required || undefined}
        defaultValue={state.values?.[name] ?? defaultValue ?? ""}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className="mt-1.5 h-11"
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function TextareaField({
  name,
  label,
  state,
  defaultValue,
  maxLength,
  hint,
  rows = 4,
  idPrefix = "field",
}: {
  name: string;
  label: string;
  state: ActionState;
  defaultValue?: string;
  maxLength?: number;
  hint?: string;
  rows?: number;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${name}`;
  const error = state.fieldErrors?.[name];
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={state.values?.[name] ?? defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className="mt-1.5 min-h-0"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
