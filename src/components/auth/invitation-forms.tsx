"use client";

import { useActionState } from "react";
import { acceptInvitationAction, createAccountAndAcceptAction } from "@/app/(auth)/povabilo/[token]/actions";
import { ActionMessage, SubmitButton, TextField } from "@/components/app/form-ui";
import { idleState } from "@/lib/forms/action-state";
import { PASSWORD_MIN } from "@/lib/validation/auth-schemas";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(async () => acceptInvitationAction(token), idleState);
  return (
    <form action={action} className="space-y-4">
      <ActionMessage state={state} />
      <SubmitButton pendingLabel="Sprejemam …">Sprejmi povabilo</SubmitButton>
    </form>
  );
}

export function CreateAccountForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(createAccountAndAcceptAction.bind(null, token), idleState);
  return (
    <form action={action} noValidate className="space-y-5">
      <div>
        <p className="text-sm font-medium text-ink">E-poštni naslov</p>
        <p className="mt-1 rounded-md border border-line bg-subtle px-3.5 py-2.5 text-sm text-ink-soft">{email}</p>
      </div>
      <TextField name="fullName" label="Ime in priimek" autoComplete="name" required maxLength={120} state={state} />
      <TextField
        name="password"
        label="Geslo"
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
      <SubmitButton pendingLabel="Ustvarjam račun …">Ustvari račun in sprejmi povabilo</SubmitButton>
    </form>
  );
}
