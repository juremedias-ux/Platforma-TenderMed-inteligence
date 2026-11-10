"use client";

import { Copy } from "lucide-react";
import { useActionState, useState } from "react";
import {
  changeMemberRoleAction,
  createInvitationAction,
  removeMemberAction,
  revokeInvitationAction,
  updateOrganizationAction,
} from "@/app/app/[organizationId]/nastavitve/actions";
import { ActionMessage, SubmitButton, TextField } from "@/components/app/form-ui";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form-controls";
import { orgRoleLabels, type OrgRole } from "@/lib/auth/permissions";
import { idleState } from "@/lib/forms/action-state";

export function OrganizationForm({
  organizationId,
  name,
  requireAcknowledgment,
}: {
  organizationId: string;
  name: string;
  requireAcknowledgment: boolean;
}) {
  const [state, action] = useActionState(updateOrganizationAction.bind(null, organizationId), idleState);
  return (
    <form action={action} className="space-y-4">
      <TextField name="name" label="Ime organizacije" required maxLength={160} defaultValue={name} state={state} />
      <div className="flex items-start gap-3">
        <input
          id="requireAcknowledgment"
          name="requireAcknowledgment"
          type="checkbox"
          defaultChecked={requireAcknowledgment}
          className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
        />
        <label htmlFor="requireAcknowledgment" className="text-sm text-ink-soft">
          Izvedbo, ki jo zabeleži zunanji serviser, mora potrditi ustanova, preden se posodobi servisni načrt.
        </label>
      </div>
      <ActionMessage state={state} />
      <SubmitButton>Shrani</SubmitButton>
    </form>
  );
}

export function MemberRoleForm({
  organizationId,
  userId,
  current,
  options,
}: {
  organizationId: string;
  userId: string;
  current: OrgRole;
  options: OrgRole[];
}) {
  const [state, action] = useActionState(changeMemberRoleAction.bind(null, organizationId, userId), idleState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Label htmlFor={`role-${userId}`} className="sr-only">
        Vloga
      </Label>
      <Select id={`role-${userId}`} name="role" defaultValue={current} className="h-9 w-52">
        {options.map((role) => (
          <option key={role} value={role}>
            {orgRoleLabels[role]}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">
        Spremeni
      </SubmitButton>
      {state.status === "error" ? (
        <p role="alert" className="w-full text-[13px] text-danger-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveMemberButton({
  organizationId,
  userId,
  name,
}: {
  organizationId: string;
  userId: string;
  name: string;
}) {
  return (
    <ConfirmAction
      label="Odstrani"
      title="Odstranitev člana"
      description={`${name} bo izgubil(a) dostop do organizacije. Zgodovina zapisov ostane ohranjena.`}
      confirmLabel="Odstrani člana"
      onConfirm={() => removeMemberAction(organizationId, userId)}
    />
  );
}

export function InvitationForm({ organizationId, roles }: { organizationId: string; roles: OrgRole[] }) {
  const [state, action] = useActionState(createInvitationAction.bind(null, organizationId), idleState);
  const [copied, setCopied] = useState(false);
  const link = state.status === "success" ? state.result?.link : undefined;

  return (
    <div className="space-y-4">
      <form action={action} noValidate className="grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <TextField name="email" label="E-poštni naslov" type="email" inputMode="email" required state={state} />
        <div>
          <Label htmlFor="invite-role">Vloga</Label>
          <Select id="invite-role" name="role" defaultValue={state.values?.role ?? "viewer"} className="mt-1.5 h-11">
            {roles.map((role) => (
              <option key={role} value={role}>
                {orgRoleLabels[role]}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton pendingLabel="Ustvarjam …">Ustvari povabilo</SubmitButton>
      </form>
      <ActionMessage state={state} />
      {link ? (
        <div className="rounded-md border border-line bg-subtle p-3">
          <p className="text-xs text-ink-muted">Povezava za {state.result?.email} (velja 7 dni, enkratna uporaba):</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-xs">{link}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              <Copy aria-hidden="true" />
              {copied ? "Kopirano" : "Kopiraj"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Povezave ne objavljajte. Kdor ima povezavo, lahko ustvari račun za ta e-poštni naslov.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInvitationButton({
  organizationId,
  invitationId,
  email,
}: {
  organizationId: string;
  invitationId: string;
  email: string;
}) {
  return (
    <ConfirmAction
      label="Prekliči"
      title="Preklic povabila"
      description={`Povezava povabila za ${email} ne bo več delovala.`}
      confirmLabel="Prekliči povabilo"
      onConfirm={() => revokeInvitationAction(organizationId, invitationId)}
    />
  );
}
