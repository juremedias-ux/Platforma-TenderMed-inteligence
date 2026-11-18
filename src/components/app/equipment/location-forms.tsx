"use client";

import { useActionState } from "react";
import { createLocationAction, updateLocationAction } from "@/app/app/[organizationId]/oprema/actions";
import { SubmitButton, TextField } from "@/components/app/form-ui";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/forms/action-state";

export function CreateLocationForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(createLocationAction.bind(null, organizationId), idleState);
  return (
    <form action={action} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField
          idPrefix="new-location"
          name="locationName"
          label="Nova lokacija"
          maxLength={120}
          required
          state={state}
        />
      </div>
      <SubmitButton variant="secondary">Dodaj</SubmitButton>
      {state.status === "success" ? (
        <p role="status" className="text-sm text-success-700 sm:self-center">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function LocationRow({
  organizationId,
  location,
}: {
  organizationId: string;
  location: { id: string; name: string; version: number; archived_at: string | null };
}) {
  const [state, action, pending] = useActionState(
    updateLocationAction.bind(null, organizationId, location.id),
    idleState,
  );
  const archived = Boolean(location.archived_at);
  return (
    <form action={action} noValidate className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
      <input type="hidden" name="version" value={location.version} />
      <div className="flex-1">
        <TextField
          idPrefix={`location-${location.id}`}
          name="locationName"
          label={archived ? `${location.name} (arhivirana)` : "Ime lokacije"}
          maxLength={120}
          defaultValue={location.name}
          state={state}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="md" variant="secondary" name="intent" value="rename" disabled={pending}>
          Preimenuj
        </Button>
        <Button
          type="submit"
          size="md"
          variant={archived ? "secondary" : "danger"}
          name="intent"
          value={archived ? "restore" : "archive"}
          disabled={pending}
        >
          {archived ? "Obnovi" : "Arhiviraj"}
        </Button>
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-danger-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
