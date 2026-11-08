"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/form-controls";
import { activityTypeLabels } from "@/features/equipment/labels";
import { completionBlocker } from "@/features/demo/state";
import type { ServiceRequest } from "@/types/domain";
import { useDemo } from "./demo-context";

/**
 * Explicit completion record, separate from the request status. Completing
 * maintenance requires a completion date and the activities performed; it
 * creates a demonstration service record and restarts interval plans.
 */
export function CompletionDialog({ request }: { request: ServiceRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ size: "sm" })}>Zabeleži izvedbo</DialogTrigger>
      {open ? (
        <DialogContent closeLabel="Zapri obrazec">
          <CompletionForm request={request} onDone={() => setOpen(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function CompletionForm({ request, onDone }: { request: ServiceRequest; onDone: () => void }) {
  const id = useId();
  const { state, dispatch, announce } = useDemo();
  const plans = state.plans.filter((p) => p.equipmentId === request.equipmentId);
  const [date, setDate] = useState(state.referenceDate);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [repair, setRepair] = useState(request.issueCategory !== "scheduled_maintenance");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const blocker = completionBlocker(request, date, planIds, repair, state.referenceDate);
    if (blocker) {
      setError(blocker);
      return;
    }
    dispatch({
      type: "record_completion",
      requestId: request.id,
      completionDate: date,
      planIds,
      includesRepair: repair,
    });
    announce("Izvedba je zabeležena. Status zahtevka ostaja nespremenjen.");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogTitle>Zabeleži izvedbo vzdrževanja</DialogTitle>
      <DialogDescription>
        Evidenca izvedbe je ločena od statusa zahtevka. Ustvari servisni zapis v demonstraciji in osveži roke izbranih
        aktivnosti.
      </DialogDescription>

      <div className="mt-6 space-y-5">
        <div>
          <Label htmlFor={`${id}-datum`}>Datum izvedbe</Label>
          <Input
            id={`${id}-datum`}
            type="date"
            className="mt-2"
            min={request.createdOn}
            max={state.referenceDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-describedby={`${id}-datum-namig`}
          />
          <FieldHint id={`${id}-datum-namig`}>Datum ne sme biti v prihodnosti ali pred datumom prijave.</FieldHint>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Izvedene aktivnosti</legend>
          <div className="mt-2 space-y-2">
            {plans.map((plan) => (
              <label
                key={plan.id}
                className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={planIds.includes(plan.id)}
                  onChange={(e) =>
                    setPlanIds((current) =>
                      e.target.checked ? [...current, plan.id] : current.filter((x) => x !== plan.id),
                    )
                  }
                  className="size-4 accent-[var(--color-accent-600)]"
                />
                {activityTypeLabels[plan.activityType]} (po servisnem načrtu)
              </label>
            ))}
            <label className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={repair}
                onChange={(e) => setRepair(e.target.checked)}
                className="size-4 accent-[var(--color-accent-600)]"
              />
              Popravilo
            </label>
          </div>
          {plans.length === 0 ? (
            <FieldHint>Za to napravo ni servisnega načrta, zato je mogoče zabeležiti le popravilo.</FieldHint>
          ) : null}
        </fieldset>

        <div aria-live="assertive">
          <FieldError id={`${id}-napaka`}>{error}</FieldError>
        </div>
      </div>

      <div className="mt-7 flex justify-end">
        <Button type="submit">Zabeleži izvedbo</Button>
      </div>
    </form>
  );
}
