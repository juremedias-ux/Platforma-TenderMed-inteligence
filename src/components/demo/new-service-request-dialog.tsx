"use client";

import { Info } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, Select } from "@/components/ui/form-controls";
import { issueCategoryLabels, urgencyLabels } from "@/features/service/labels";
import { compareIsoDates, isValidIsoDate } from "@/lib/dates/date-only";
import type { IssueCategory, ServiceRequestUrgency } from "@/types/domain";
import { useDemo } from "./demo-context";

interface Props {
  open: boolean;
  initialEquipmentId?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (requestId: string) => void;
}

export function NewServiceRequestDialog({ open, initialEquipmentId, onOpenChange, onCreated }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="max-w-xl" closeLabel="Zapri obrazec">
          <NewRequestForm
            key={initialEquipmentId ?? "none"}
            initialEquipmentId={initialEquipmentId}
            onDone={(id) => {
              onOpenChange(false);
              onCreated(id);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function NewRequestForm({
  initialEquipmentId,
  onDone,
  onCancel,
}: {
  initialEquipmentId?: string;
  onDone: (requestId: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const { snapshot, state, dispatch, announce } = useDemo();
  const { dataset } = snapshot;
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId ?? "");
  const [issueCategory, setIssueCategory] = useState<IssueCategory | "">("");
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>("normal");
  const [proposedDate, setProposedDate] = useState("");
  const [replacement, setReplacement] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!equipmentId) next.equipmentId = "Izberite napravo.";
    if (!issueCategory) next.issueCategory = "Izberite vrsto težave.";
    if (proposedDate && !isValidIsoDate(proposedDate)) next.proposedDate = "Vnesite veljaven datum.";
    else if (proposedDate && compareIsoDates(proposedDate, state.referenceDate) < 0) {
      next.proposedDate = "Predlagani termin ne sme biti v preteklosti.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = ["equipmentId", "issueCategory", "proposedDate"].find((key) => next[key]);
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }

    const newId = `sr-demo-${state.sequence + 1}`;
    dispatch({
      type: "create_service_request",
      equipmentId,
      issueCategory: issueCategory as IssueCategory,
      urgency,
      proposedAppointment: proposedDate || null,
      replacementEquipmentRequested: replacement,
    });
    announce("Servisni zahtevek je ustvarjen v demonstraciji.");
    onDone(newId);
  }

  const err = (key: string) => (errors[key] ? `${id}-${key}-napaka` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogTitle>Nov servisni zahtevek</DialogTitle>
      <DialogDescription>
        Demonstracija uporablja samo strukturirana polja. Zahtevek ostane v tem zavihku brskalnika in se nikamor ne
        pošlje.
      </DialogDescription>

      <div className="mt-6 space-y-5">
        <div>
          <Label htmlFor={`${id}-equipmentId`}>Naprava</Label>
          <Select
            id={`${id}-equipmentId`}
            className="mt-2 h-11"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            aria-invalid={Boolean(errors.equipmentId)}
            aria-describedby={err("equipmentId")}
          >
            <option value="">Izberite napravo …</option>
            {dataset.equipment.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name} {equipment.model} · {equipment.serialNumber}
              </option>
            ))}
          </Select>
          <FieldError id={`${id}-equipmentId-napaka`}>{errors.equipmentId}</FieldError>
        </div>

        <div>
          <Label htmlFor={`${id}-issueCategory`}>Vrsta težave</Label>
          <Select
            id={`${id}-issueCategory`}
            className="mt-2 h-11"
            value={issueCategory}
            onChange={(e) => setIssueCategory(e.target.value as IssueCategory)}
            aria-invalid={Boolean(errors.issueCategory)}
            aria-describedby={err("issueCategory")}
          >
            <option value="">Izberite vrsto težave …</option>
            {(Object.keys(issueCategoryLabels) as IssueCategory[]).map((category) => (
              <option key={category} value={category}>
                {issueCategoryLabels[category]}
              </option>
            ))}
          </Select>
          <FieldError id={`${id}-issueCategory-napaka`}>{errors.issueCategory}</FieldError>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Nujnost</legend>
          <div className="mt-2 flex gap-2">
            {(Object.keys(urgencyLabels) as ServiceRequestUrgency[]).map((value) => (
              <label
                key={value}
                className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-md border border-line-strong px-3 py-2.5 text-sm text-ink-soft has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50 has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-600/30"
              >
                <input
                  type="radio"
                  name={`${id}-urgency`}
                  value={value}
                  checked={urgency === value}
                  onChange={() => setUrgency(value)}
                  className="size-4 accent-[var(--color-accent-600)]"
                />
                {urgencyLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor={`${id}-proposedDate`}>
            Predlagani termin <span className="font-normal text-ink-muted">(neobvezno)</span>
          </Label>
          <Input
            id={`${id}-proposedDate`}
            type="date"
            className="mt-2"
            min={state.referenceDate}
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            aria-invalid={Boolean(errors.proposedDate)}
            aria-describedby={[err("proposedDate"), `${id}-proposedDate-namig`].filter(Boolean).join(" ")}
          />
          <FieldError id={`${id}-proposedDate-napaka`}>{errors.proposedDate}</FieldError>
          <FieldHint id={`${id}-proposedDate-namig`}>
            Predlog termina še ni potrditev. Termin potrdi serviser.
          </FieldHint>
        </div>

        <div className="flex items-start gap-3">
          <input
            id={`${id}-replacement`}
            type="checkbox"
            checked={replacement}
            onChange={(e) => setReplacement(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent-600)]"
            aria-describedby={`${id}-replacement-namig`}
          />
          <div>
            <label htmlFor={`${id}-replacement`} className="text-sm font-medium text-ink">
              Med servisom potrebujemo nadomestno opremo
            </label>
            <FieldHint id={`${id}-replacement-namig`} className="mt-0.5">
              Razpoložljivost nadomestne opreme je odvisna od ponudnika in pogodbenega dogovora.
            </FieldHint>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-md bg-subtle px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden="true" />
          Ne vnašajte resničnih osebnih, zdravstvenih ali poslovno zaupnih podatkov.
        </p>
      </div>

      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Prekliči
        </Button>
        <Button type="submit">Ustvari zahtevek</Button>
      </div>
    </form>
  );
}
