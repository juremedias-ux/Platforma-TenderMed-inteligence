"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import {
  createEquipmentAction,
  createPlanAction,
  setEquipmentArchivedAction,
  setPlanArchivedAction,
  updateEquipmentAction,
  updatePlanAction,
} from "@/app/app/[organizationId]/oprema/actions";
import { ConfirmAction } from "@/components/app/confirm-action";
import { ActionMessage, SelectField, SubmitButton, TextareaField, TextField } from "@/components/app/form-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  activityTypeLabels,
  activityTypes,
  equipmentCategories,
  equipmentCategoryLabels,
  equipmentStatuses,
  equipmentStatusLabels,
  scheduleModeDescriptions,
  scheduleModeLabels,
  scheduleModes,
  sourceBases,
  sourceBasisLabels,
} from "@/lib/equipment/domain";
import { idleState, type ActionState } from "@/lib/forms/action-state";

export interface Option {
  id: string;
  name: string;
}

export interface EquipmentDefaults {
  id: string;
  version: number;
  name: string;
  category: string;
  asset_tag: string | null;
  manufacturer_name: string | null;
  model: string | null;
  serial_number: string | null;
  location_id: string | null;
  responsible_user_id: string | null;
  purchase_date: string | null;
  commissioning_date: string | null;
  warranty_end_date: string | null;
  status: string;
  notes: string | null;
}

const categoryOptions = equipmentCategories.map((value) => ({ value, label: equipmentCategoryLabels[value] }));
const statusOptions = equipmentStatuses
  .filter((s) => s !== "archived")
  .map((value) => ({ value, label: equipmentStatusLabels[value] }));

function EquipmentFields({
  state,
  defaults,
  locations,
  members,
}: {
  state: ActionState;
  defaults?: EquipmentDefaults;
  locations: Option[];
  members: Option[];
}) {
  const p = "equipment";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField
          idPrefix={p}
          name="name"
          label="Naziv"
          required
          maxLength={160}
          defaultValue={defaults?.name}
          state={state}
        />
      </div>
      <SelectField
        idPrefix={p}
        name="category"
        label="Kategorija"
        required
        placeholder="Izberite …"
        options={categoryOptions}
        defaultValue={defaults?.category}
        state={state}
      />
      <SelectField
        idPrefix={p}
        name="status"
        label="Status"
        required
        options={
          defaults?.status === "archived"
            ? [{ value: "archived", label: equipmentStatusLabels.archived }, ...statusOptions]
            : statusOptions
        }
        defaultValue={defaults?.status ?? "active"}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="assetTag"
        label="Inventarna številka"
        maxLength={64}
        defaultValue={defaults?.asset_tag ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="manufacturerName"
        label="Proizvajalec"
        maxLength={120}
        defaultValue={defaults?.manufacturer_name ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="model"
        label="Model"
        maxLength={120}
        defaultValue={defaults?.model ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="serialNumber"
        label="Serijska številka"
        maxLength={120}
        defaultValue={defaults?.serial_number ?? ""}
        state={state}
      />
      <SelectField
        idPrefix={p}
        name="locationId"
        label="Lokacija"
        placeholder="Brez lokacije"
        options={locations.map((l) => ({ value: l.id, label: l.name }))}
        defaultValue={defaults?.location_id ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="newLocation"
        label="ali nova lokacija"
        maxLength={120}
        hint="Če lokacije ni na seznamu, jo vpišite tukaj."
        state={state}
      />
      <SelectField
        idPrefix={p}
        name="responsibleUserId"
        label="Odgovorna oseba"
        placeholder="Ni določena"
        options={members.map((m) => ({ value: m.id, label: m.name }))}
        defaultValue={defaults?.responsible_user_id ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="purchaseDate"
        label="Datum nakupa"
        type="date"
        defaultValue={defaults?.purchase_date ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="commissioningDate"
        label="Datum zagona"
        type="date"
        defaultValue={defaults?.commissioning_date ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="warrantyEndDate"
        label="Garancija do"
        type="date"
        defaultValue={defaults?.warranty_end_date ?? ""}
        state={state}
      />
      <div className="sm:col-span-2">
        <TextareaField
          idPrefix={p}
          name="notes"
          label="Opombe"
          maxLength={4000}
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          state={state}
        />
      </div>
    </div>
  );
}

export function CreateEquipmentDialog({
  organizationId,
  locations,
  members,
}: {
  organizationId: string;
  locations: Option[];
  members: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createEquipmentAction.bind(null, organizationId), idleState);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Dodaj opremo
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-2xl">
          <DialogTitle>Nova oprema</DialogTitle>
          <DialogDescription>
            Obvezna sta naziv in kategorija. Ostale podatke lahko dopolnite kasneje.
          </DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-5">
            <EquipmentFields state={state} locations={locations} members={members} />
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <SubmitButton>Shrani opremo</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function EditEquipmentDialog({
  organizationId,
  equipment,
  locations,
  members,
}: {
  organizationId: string;
  equipment: EquipmentDefaults;
  locations: Option[];
  members: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateEquipmentAction(organizationId, equipment.id, previous, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, idleState);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden="true" />
        Uredi
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-2xl">
          <DialogTitle>Uredi opremo</DialogTitle>
          <form action={action} noValidate className="mt-5 space-y-5">
            <input type="hidden" name="version" value={equipment.version} />
            <EquipmentFields state={state} defaults={equipment} locations={locations} members={members} />
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <SubmitButton>Shrani</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ArchiveEquipmentButton({
  organizationId,
  equipmentId,
  version,
  archived,
}: {
  organizationId: string;
  equipmentId: string;
  version: number;
  archived: boolean;
}) {
  return archived ? (
    <ConfirmAction
      variant="secondary"
      size="md"
      label="Vrni v evidenco"
      title="Vrnitev opreme v evidenco"
      description="Oprema bo znova prikazana v seznamu, koledarju in pregledu s statusom »V uporabi«."
      confirmLabel="Vrni v evidenco"
      onConfirm={() => setEquipmentArchivedAction(organizationId, equipmentId, version, false)}
    />
  ) : (
    <ConfirmAction
      size="md"
      label="Arhiviraj"
      title="Arhiviranje opreme"
      description="Oprema ne bo več prikazana v seznamu, koledarju in opomnikih. Zgodovina in načrti ostanejo shranjeni; opremo lahko kadar koli vrnete v evidenco."
      confirmLabel="Arhiviraj"
      onConfirm={() => setEquipmentArchivedAction(organizationId, equipmentId, version, true)}
    />
  );
}

export interface PlanDefaults {
  id: string;
  version: number;
  activity_type: string;
  activity_label: string | null;
  schedule_mode: string;
  interval_months: number | null;
  anchor_date: string | null;
  due_date: string | null;
  responsible_user_id: string | null;
  reminder_days: number[];
  source_basis: string;
  source_note: string | null;
}

function PlanFields({ state, defaults, members }: { state: ActionState; defaults?: PlanDefaults; members: Option[] }) {
  const p = `plan-${defaults?.id ?? "new"}`;
  const [mode, setMode] = useState(state.values?.scheduleMode ?? defaults?.schedule_mode ?? "fixed_calendar");
  const recurring = mode !== "one_off";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        idPrefix={p}
        name="activityType"
        label="Aktivnost"
        required
        options={activityTypes.map((value) => ({ value, label: activityTypeLabels[value] }))}
        defaultValue={defaults?.activity_type ?? "preventive_maintenance"}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="activityLabel"
        label="Opis aktivnosti"
        maxLength={120}
        hint="Obvezno pri »Drugo«."
        defaultValue={defaults?.activity_label ?? ""}
        state={state}
      />
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-ink">Način določanja rokov</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {scheduleModes.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-1 rounded-md border border-line-strong p-3 text-sm has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
            >
              <span className="flex items-center gap-2 font-medium text-ink">
                <input
                  type="radio"
                  name="scheduleMode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="accent-[var(--color-accent-600)]"
                />
                {scheduleModeLabels[value]}
              </span>
              <span className="text-[13px] leading-snug text-ink-muted">{scheduleModeDescriptions[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {recurring ? (
        <>
          <TextField
            idPrefix={p}
            name="intervalMonths"
            label="Interval (meseci)"
            inputMode="numeric"
            required
            maxLength={3}
            defaultValue={defaults?.interval_months ? String(defaults.interval_months) : "12"}
            state={state}
          />
          <TextField
            idPrefix={p}
            name="anchorDate"
            label={mode === "fixed_calendar" ? "Začetni rok koledarja" : "Prvi rok (pred prvo izvedbo)"}
            type="date"
            required
            defaultValue={defaults?.anchor_date ?? ""}
            state={state}
          />
          <input type="hidden" name="dueDate" value="" />
        </>
      ) : (
        <>
          <TextField
            idPrefix={p}
            name="dueDate"
            label="Rok"
            type="date"
            required
            defaultValue={defaults?.due_date ?? ""}
            state={state}
          />
          <input type="hidden" name="intervalMonths" value="" />
          <input type="hidden" name="anchorDate" value="" />
        </>
      )}
      <SelectField
        idPrefix={p}
        name="sourceBasis"
        label="Podlaga za interval"
        required
        options={sourceBases.map((value) => ({ value, label: sourceBasisLabels[value] }))}
        defaultValue={defaults?.source_basis ?? "manufacturer_instructions"}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="sourceNote"
        label="Sklic na vir"
        maxLength={500}
        hint="Npr. poglavje navodil ali člen pogodbe."
        defaultValue={defaults?.source_note ?? ""}
        state={state}
      />
      <SelectField
        idPrefix={p}
        name="responsibleUserId"
        label="Odgovorna oseba"
        placeholder="Ni določena"
        options={members.map((m) => ({ value: m.id, label: m.name }))}
        defaultValue={defaults?.responsible_user_id ?? ""}
        state={state}
      />
      <TextField
        idPrefix={p}
        name="reminderDays"
        label="Opomniki (dni pred rokom)"
        maxLength={40}
        hint="Npr. 30, 7. Prazno pomeni brez opomnikov."
        defaultValue={defaults ? defaults.reminder_days.join(", ") : "30, 7"}
        state={state}
      />
    </div>
  );
}

export function PlanDialog({
  organizationId,
  equipmentId,
  plan,
  members,
}: {
  organizationId: string;
  equipmentId: string;
  plan?: PlanDefaults;
  members: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = plan
      ? await updatePlanAction(organizationId, plan.id, previous, formData)
      : await createPlanAction(organizationId, equipmentId, previous, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, idleState);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {plan ? (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Uredi
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Dodaj načrt
        </Button>
      )}
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-2xl">
          <DialogTitle>{plan ? "Uredi servisni načrt" : "Nov servisni načrt"}</DialogTitle>
          <DialogDescription>
            Interval vpišite po navodilih proizvajalca, internem postopku ali pogodbi. Platforma intervalov ne predlaga.
          </DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-5">
            {plan ? <input type="hidden" name="version" value={plan.version} /> : null}
            <PlanFields state={state} defaults={plan} members={members} />
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <SubmitButton>Shrani načrt</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ArchivePlanButton({
  organizationId,
  planId,
  version,
  archived,
}: {
  organizationId: string;
  planId: string;
  version: number;
  archived: boolean;
}) {
  return archived ? (
    <ConfirmAction
      variant="secondary"
      label="Obnovi"
      title="Obnovitev načrta"
      description="Načrt bo znova aktiven; roki se izračunajo iz zabeleženih izvedb."
      confirmLabel="Obnovi"
      onConfirm={() => setPlanArchivedAction(organizationId, planId, version, false)}
    />
  ) : (
    <ConfirmAction
      label="Arhiviraj"
      title="Arhiviranje načrta"
      description="Načrt ne bo več ustvarjal rokov in opomnikov. Zgodovina ostane shranjena."
      confirmLabel="Arhiviraj"
      onConfirm={() => setPlanArchivedAction(organizationId, planId, version, true)}
    />
  );
}
