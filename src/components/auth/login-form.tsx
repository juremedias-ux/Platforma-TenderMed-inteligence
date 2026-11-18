"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/(auth)/actions";
import { ActionMessage, SubmitButton, TextField } from "@/components/app/form-ui";
import { idleState } from "@/lib/forms/action-state";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, idleState);
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <TextField
        name="email"
        label="E-poštni naslov"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        state={state}
      />
      <TextField name="password" label="Geslo" type="password" autoComplete="current-password" required state={state} />
      <ActionMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton pendingLabel="Prijavljam …">Prijava</SubmitButton>
        <Link href="/pozabljeno-geslo" className="text-sm font-medium text-accent-700 hover:text-accent-800">
          Pozabljeno geslo?
        </Link>
      </div>
    </form>
  );
}
