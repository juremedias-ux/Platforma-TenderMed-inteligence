"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, updatePasswordAction } from "@/app/(auth)/actions";
import { ActionMessage, SubmitButton, TextField } from "@/components/app/form-ui";
import { idleState } from "@/lib/forms/action-state";
import { PASSWORD_MIN } from "@/lib/validation/auth-schemas";

export function PasswordResetRequestForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idleState);
  if (state.status === "success") return <ActionMessage state={state} />;
  return (
    <form action={action} noValidate className="space-y-5">
      <TextField
        name="email"
        label="E-poštni naslov"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        state={state}
      />
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Pošiljam …">Pošlji povezavo</SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, idleState);
  return (
    <form action={action} noValidate className="space-y-5">
      <TextField
        name="password"
        label="Novo geslo"
        type="password"
        autoComplete="new-password"
        required
        hint={`Vsaj ${PASSWORD_MIN} znakov.`}
        state={state}
      />
      <TextField
        name="confirm"
        label="Ponovite geslo"
        type="password"
        autoComplete="new-password"
        required
        state={state}
      />
      <ActionMessage state={state} />
      <SubmitButton>Shrani novo geslo</SubmitButton>
    </form>
  );
}
