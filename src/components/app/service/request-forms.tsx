"use client";

import { Copy, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import {
  acknowledgeCompletionAction,
  createServiceRequestAction,
  inviteAssigneeAction,
  postMessageAction,
  proposeAppointmentAction,
  recordCompletionAction,
  respondAppointmentAction,
  revokeAssignmentAction,
  setReplacementStatusAction,
  transitionRequestAction,
  updateServiceRequestAction,
  voidCompletionAction,
} from "@/app/app/service-actions";
import { ConfirmAction } from "@/components/app/confirm-action";
import { ActionMessage, SelectField, SubmitButton, TextareaField, TextField } from "@/components/app/form-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { idleState, type ActionState } from "@/lib/forms/action-state";
import {
  outcomeLabels,
  outcomes,
  priorities,
  priorityLabels,
  replacementStatusLabels,
  replacementTransitions,
  requestTypeLabels,
  requestTypes,
  transitionLabels,
  type ReplacementStatus,
  type RequestStatus,
} from "@/lib/service/domain";

const typeOptions = requestTypes.map((value) => ({ value, label: requestTypeLabels[value] }));
const priorityOptions = priorities.map((value) => ({ value, label: priorityLabels[value] }));

export interface EquipmentChoice {
  id: string;
  name: string;
  plans: { id: string; label: string }[];
}

/** Dialog wrapper that closes itself after a successful action. */
function useClosingAction(
  run: (previous: ActionState, formData: FormData) => Promise<ActionState>,
  setOpen: (open: boolean) => void,
) {
  return useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await run(previous, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, idleState);
}

export function CreateRequestDialog({
  organizationId,
  equipment,
  defaultEquipmentId,
  defaultPlanId,
  label = "Nov zahtevek",
}: {
  organizationId: string;
  equipment: EquipmentChoice[];
  defaultEquipmentId?: string;
  defaultPlanId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createServiceRequestAction.bind(null, organizationId), idleState);
  const [equipmentId, setEquipmentId] = useState(state.values?.equipmentId ?? defaultEquipmentId ?? "");
  const plans = equipment.find((e) => e.id === equipmentId)?.plans ?? [];
  const p = "request";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {label}
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-2xl">
          <DialogTitle>Nov servisni zahtevek</DialogTitle>
          <DialogDescription>
            Zahtevek odpre usklajevanje s serviserjem. Serviserja povabite na strani zahtevka.
          </DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${p}-equipmentId`} className="block text-sm font-medium text-ink">
                  Oprema<span className="sr-only"> (obvezno)</span>
                </label>
                <select
                  id={`${p}-equipmentId`}
                  name="equipmentId"
                  required
                  value={equipmentId}
                  onChange={(event) => setEquipmentId(event.target.value)}
                  aria-invalid={Boolean(state.fieldErrors?.equipmentId)}
                  className="select-chevron mt-1.5 h-11 w-full cursor-pointer appearance-none rounded-md border border-line-strong bg-surface pr-9 pl-3 text-sm shadow-card"
                >
                  <option value="">Izberite …</option>
                  {equipment.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                {state.fieldErrors?.equipmentId ? (
                  <p className="mt-2 text-sm text-danger-700">{state.fieldErrors.equipmentId}</p>
                ) : null}
              </div>
              <SelectField
                key={equipmentId}
                idPrefix={p}
                name="planId"
                label="Servisni načrt"
                placeholder={plans.length ? "Brez načrta" : "Oprema nima aktivnih načrtov"}
                options={plans.map((plan) => ({ value: plan.id, label: plan.label }))}
                defaultValue={equipmentId === defaultEquipmentId ? defaultPlanId : ""}
                hint="Izvedba v okviru načrta premakne njegov naslednji rok."
                state={state}
              />
              <SelectField
                idPrefix={p}
                name="requestType"
                label="Vrsta"
                required
                options={typeOptions}
                defaultValue="inspection"
                state={state}
              />
              <SelectField
                idPrefix={p}
                name="priority"
                label="Nujnost"
                required
                options={priorityOptions}
                defaultValue="normal"
                state={state}
              />
              <div className="sm:col-span-2">
                <TextField idPrefix={p} name="title" label="Naslov" required maxLength={160} state={state} />
              </div>
              <div className="sm:col-span-2">
                <TextareaField idPrefix={p} name="description" label="Opis" maxLength={4000} rows={4} state={state} />
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="replacementNeeded"
                className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
              />
              Med servisom potrebujemo nadomestno opremo.
            </label>
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <SubmitButton>Odpri zahtevek</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function EditRequestDialog({
  organizationId,
  request,
}: {
  organizationId: string;
  request: { id: string; version: number; title: string; description: string | null; priority: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useClosingAction(
    (previous, formData) => updateServiceRequestAction(organizationId, request.id, previous, formData),
    setOpen,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Uredi
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-xl">
          <DialogTitle>Uredi zahtevek</DialogTitle>
          <form action={action} noValidate className="mt-5 space-y-4">
            <input type="hidden" name="version" value={request.version} />
            <TextField
              idPrefix="edit"
              name="title"
              label="Naslov"
              required
              maxLength={160}
              defaultValue={request.title}
              state={state}
            />
            <TextareaField
              idPrefix="edit"
              name="description"
              label="Opis"
              maxLength={4000}
              defaultValue={request.description ?? ""}
              state={state}
            />
            <SelectField
              idPrefix="edit"
              name="priority"
              label="Nujnost"
              options={priorityOptions}
              defaultValue={request.priority}
              state={state}
            />
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

const noFormData = () => new FormData();

export function TransitionButtons({
  requestId,
  version,
  transitions,
}: {
  requestId: string;
  version: number;
  transitions: RequestStatus[];
}) {
  return (
    <>
      {transitions
        .filter((to) => to !== "preklicano")
        .map((to) => (
          <ConfirmAction
            key={to}
            variant={to === "zakljuceno" ? "primary" : "secondary"}
            size="md"
            label={transitionLabels[to] ?? to}
            title={transitionLabels[to] ?? to}
            description={
              to === "zakljuceno"
                ? "Zahtevek bo zaključen. Po zaključku ga ni mogoče več urejati."
                : to === "v_usklajevanju"
                  ? "Potrjeni termin bo sproščen in usklajevanje se začne znova."
                  : "Zahtevek bo označen kot v izvedbi."
            }
            confirmLabel="Potrdi"
            onConfirm={() => transitionRequestAction(requestId, version, to, idleState, noFormData())}
          />
        ))}
      {transitions.includes("preklicano") ? <CancelRequestDialog requestId={requestId} version={version} /> : null}
    </>
  );
}

function CancelRequestDialog({ requestId, version }: { requestId: string; version: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useClosingAction(
    (previous, formData) => transitionRequestAction(requestId, version, "preklicano", previous, formData),
    setOpen,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Prekliči zahtevek
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri">
          <DialogTitle>Preklic zahtevka</DialogTitle>
          <DialogDescription>Razlog preklica bo viden vsem udeležencem zahtevka.</DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-4">
            <TextareaField idPrefix="cancel" name="note" label="Razlog" maxLength={1000} rows={3} state={state} />
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Nazaj
              </Button>
              <SubmitButton variant="danger">Prekliči zahtevek</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ProposeAppointmentForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(proposeAppointmentAction.bind(null, requestId), idleState);
  return (
    <form action={action} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField idPrefix="appointment" name="date" label="Datum" type="date" required state={state} />
        <TextField idPrefix="appointment" name="startTime" label="Od" type="time" required state={state} />
        <TextField idPrefix="appointment" name="endTime" label="Do" type="time" required state={state} />
      </div>
      <TextField idPrefix="appointment" name="note" label="Opomba" maxLength={1000} state={state} />
      <p className="text-[13px] text-ink-muted">Čas je po slovenskem času (Europe/Ljubljana).</p>
      <ActionMessage state={state} />
      <SubmitButton variant="secondary">Predlagaj termin</SubmitButton>
    </form>
  );
}

export function ProposalActions({
  proposalId,
  canDecide,
  canWithdraw,
}: {
  proposalId: string;
  canDecide: boolean;
  canWithdraw: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide ? (
        <>
          <ConfirmAction
            variant="primary"
            label="Sprejmi"
            title="Sprejem termina"
            description="Termin bo potrjen, ostali predlogi pa nadomeščeni."
            confirmLabel="Sprejmi termin"
            onConfirm={() => respondAppointmentAction(proposalId, "accept")}
          />
          <ConfirmAction
            label="Zavrni"
            title="Zavrnitev termina"
            description="Predlog bo zavrnjen. Predlagate lahko drug termin."
            confirmLabel="Zavrni"
            onConfirm={() => respondAppointmentAction(proposalId, "decline")}
          />
        </>
      ) : null}
      {canWithdraw ? (
        <ConfirmAction
          variant="secondary"
          label="Umakni"
          title="Umik predloga"
          description="Predlog termina bo umaknjen."
          confirmLabel="Umakni"
          onConfirm={() => respondAppointmentAction(proposalId, "withdraw")}
        />
      ) : null}
    </div>
  );
}

export function CompletionForm({
  requestId,
  today,
  replaces,
  acknowledgmentNote,
}: {
  requestId: string;
  today: string;
  replaces?: { id: string; label: string }[];
  acknowledgmentNote?: string;
}) {
  const [state, action] = useActionState(recordCompletionAction.bind(null, requestId), idleState);
  return (
    <form action={action} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          idPrefix="completion"
          name="completedOn"
          label="Datum izvedbe"
          type="date"
          required
          defaultValue={today}
          state={state}
        />
        <SelectField
          idPrefix="completion"
          name="outcome"
          label="Izid"
          required
          options={outcomes.map((value) => ({ value, label: outcomeLabels[value] }))}
          defaultValue="completed"
          state={state}
        />
      </div>
      <TextareaField
        idPrefix="completion"
        name="summary"
        label="Opis opravljenega dela in ugotovitev"
        maxLength={4000}
        rows={4}
        state={state}
      />
      {replaces && replaces.length > 0 ? (
        <SelectField
          idPrefix="completion"
          name="replaces"
          label="Popravek razveljavljenega zapisa"
          placeholder="Ni popravek"
          options={replaces.map((r) => ({ value: r.id, label: r.label }))}
          state={state}
        />
      ) : (
        <input type="hidden" name="replaces" value="" />
      )}
      {acknowledgmentNote ? <p className="text-[13px] text-ink-muted">{acknowledgmentNote}</p> : null}
      <ActionMessage state={state} />
      <SubmitButton>Zabeleži izvedbo</SubmitButton>
    </form>
  );
}

export function AcknowledgeForms({ completionId }: { completionId: string }) {
  const [acceptState, accept] = useActionState(acknowledgeCompletionAction.bind(null, completionId, true), idleState);
  const [rejectState, reject] = useActionState(acknowledgeCompletionAction.bind(null, completionId, false), idleState);
  return (
    <div className="grid gap-4 rounded-md border border-warning-200 bg-warning-50/50 p-4 sm:grid-cols-2">
      <form action={accept} noValidate className="space-y-3">
        <TextField
          idPrefix={`ack-${completionId}`}
          name="note"
          label="Opomba ob potrditvi (neobvezno)"
          maxLength={1000}
          state={acceptState}
        />
        <ActionMessage state={acceptState} />
        <SubmitButton>Potrdi izvedbo</SubmitButton>
      </form>
      <form action={reject} noValidate className="space-y-3">
        <TextField
          idPrefix={`reject-${completionId}`}
          name="note"
          label="Razlog zavrnitve"
          maxLength={1000}
          state={rejectState}
        />
        <ActionMessage state={rejectState} />
        <SubmitButton variant="danger">Zavrni</SubmitButton>
      </form>
    </div>
  );
}

export function VoidCompletionDialog({ completionId }: { completionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useClosingAction(
    (previous, formData) => voidCompletionAction(completionId, previous, formData),
    setOpen,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        Razveljavi
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri">
          <DialogTitle>Razveljavitev zapisa o izvedbi</DialogTitle>
          <DialogDescription>
            Zapis ostane v zgodovini kot razveljavljen. Servisni načrt se preračuna, zahtevek pa se vrne v izvedbo.
          </DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-4">
            <TextareaField
              idPrefix={`void-${completionId}`}
              name="reason"
              label="Razlog"
              maxLength={1000}
              rows={3}
              state={state}
            />
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Nazaj
              </Button>
              <SubmitButton variant="danger">Razveljavi</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ReplacementControls({
  requestId,
  version,
  status,
}: {
  requestId: string;
  version: number;
  status: ReplacementStatus;
}) {
  const next = replacementTransitions[status];
  if (next.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((target) => (
        <ConfirmAction
          key={target}
          variant="secondary"
          label={
            target === "not_needed" ? "Ni več potrebna" : `Označi: ${replacementStatusLabels[target].toLowerCase()}`
          }
          title="Nadomestna oprema"
          description={`Novo stanje: ${replacementStatusLabels[target]}.`}
          confirmLabel="Potrdi"
          onConfirm={() => setReplacementStatusAction(requestId, version, target)}
        />
      ))}
    </div>
  );
}

export function MessageForm({
  organizationId,
  requestId,
  allowInternal,
}: {
  organizationId: string;
  requestId: string;
  allowInternal: boolean;
}) {
  const [state, action] = useActionState(postMessageAction.bind(null, organizationId, requestId), idleState);
  return (
    <form action={action} noValidate className="space-y-3">
      <TextareaField idPrefix="message" name="body" label="Novo sporočilo" maxLength={4000} rows={3} state={state} />
      {allowInternal ? (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">Vidnost</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="visibility"
              value="shared"
              defaultChecked
              className="accent-[var(--color-accent-600)]"
            />
            Vidno serviserju
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="visibility" value="internal" className="accent-[var(--color-accent-600)]" />
            Samo interno (organizacija)
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="visibility" value="shared" />
      )}
      <ActionMessage state={state} />
      <SubmitButton variant="secondary">Pošlji</SubmitButton>
    </form>
  );
}

export function InviteAssigneeForm({ organizationId, requestId }: { organizationId: string; requestId: string }) {
  const [state, action] = useActionState(inviteAssigneeAction.bind(null, organizationId, requestId), idleState);
  const [copied, setCopied] = useState(false);
  const link = state.status === "success" ? state.result?.link : undefined;
  return (
    <div className="space-y-3">
      <form action={action} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            idPrefix="assignee"
            name="email"
            label="E-pošta serviserja"
            type="email"
            inputMode="email"
            required
            state={state}
          />
        </div>
        <SubmitButton variant="secondary" pendingLabel="Ustvarjam …">
          Povabi
        </SubmitButton>
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
        </div>
      ) : null}
    </div>
  );
}

export function RevokeAssignmentButton({
  organizationId,
  assignmentId,
  name,
}: {
  organizationId: string;
  assignmentId: string;
  name: string;
}) {
  return (
    <ConfirmAction
      label="Odvzemi dostop"
      title="Odvzem dostopa"
      description={`${name} ne bo več videl(a) tega zahtevka. Zgodovina ostane ohranjena.`}
      confirmLabel="Odvzemi dostop"
      onConfirm={() => revokeAssignmentAction(organizationId, assignmentId)}
    />
  );
}
