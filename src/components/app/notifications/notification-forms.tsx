"use client";

import { useActionState, useTransition } from "react";
import { markNotificationsReadAction, updatePreferencesAction } from "@/app/app/notification-actions";
import { ActionMessage, SubmitButton } from "@/components/app/form-ui";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/forms/action-state";

export function MarkAllReadButton({ organizationId }: { organizationId?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => start(async () => void (await markNotificationsReadAction({ organizationId })))}
    >
      {pending ? "Označujem …" : "Označi vse kot prebrano"}
    </Button>
  );
}

export function MarkReadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => start(async () => void (await markNotificationsReadAction({ id })))}
    >
      Prebrano
    </Button>
  );
}

export function PreferencesForm({
  emailReminders,
  emailServiceUpdates,
  emailConfigured,
}: {
  emailReminders: boolean;
  emailServiceUpdates: boolean;
  emailConfigured: boolean;
}) {
  const [state, action] = useActionState(updatePreferencesAction, idleState);
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="emailReminders"
          defaultChecked={emailReminders}
          className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
        />
        Opomniki o servisnih rokih po e-pošti
      </label>
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="emailServiceUpdates"
          defaultChecked={emailServiceUpdates}
          className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
        />
        Spremembe pri servisnih zahtevkih po e-pošti (termini, izvedbe, sporočila)
      </label>
      {!emailConfigured ? (
        <p className="text-[13px] text-ink-muted">
          Pošiljanje e-pošte na platformi še ni konfigurirano. Obvestila so zaenkrat vidna samo v aplikaciji.
        </p>
      ) : null}
      <ActionMessage state={state} />
      <SubmitButton variant="secondary">Shrani nastavitve</SubmitButton>
    </form>
  );
}
