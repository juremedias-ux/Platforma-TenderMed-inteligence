"use client";

import { Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import {
  answerInquiryAction,
  closeInquiryAction,
  createInquiryAction,
  savePrivateNoteAction,
  saveProductAction,
  setFeedbackAction,
  setProductStatusAction,
} from "@/app/app/[organizationId]/katalog/actions";
import { ConfirmAction } from "@/components/app/confirm-action";
import { ActionMessage, SelectField, SubmitButton, TextareaField, TextField } from "@/components/app/form-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { productTypeLabels, productTypes } from "@/lib/catalog/domain";
import { equipmentCategories, equipmentCategoryLabels } from "@/lib/equipment/domain";
import { idleState, type ActionState } from "@/lib/forms/action-state";

export interface EditableProduct {
  id: string;
  version: number;
  name: string;
  product_type: string;
  category: string;
  manufacturer_name: string | null;
  model: string | null;
  description: string | null;
  status: string;
  compatibility: { manufacturer_name: string; model: string }[];
  sources: { title: string; url: string; retrieved_on: string | null }[];
}

export function ProductEditorDialog({
  organizationId,
  product,
}: {
  organizationId: string;
  product?: EditableProduct;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await saveProductAction(
      organizationId,
      product?.id ?? null,
      product?.version ?? null,
      previous,
      formData,
    );
    if (result.status === "success") setOpen(false);
    return result;
  }, idleState);
  const p = `product-${product?.id ?? "new"}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {product ? (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Uredi
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Nov izdelek
        </Button>
      )}
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-2xl">
          <DialogTitle>{product ? "Uredi izdelek" : "Nov izdelek"}</DialogTitle>
          <DialogDescription>
            Navedite samo preverljive podatke. Združljivost in viri so prikazani uporabnikom ob izdelku.
          </DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  idPrefix={p}
                  name="name"
                  label="Ime"
                  required
                  maxLength={160}
                  defaultValue={product?.name}
                  state={state}
                />
              </div>
              <SelectField
                idPrefix={p}
                name="productType"
                label="Vrsta"
                required
                options={productTypes.map((value) => ({ value, label: productTypeLabels[value] }))}
                defaultValue={product?.product_type ?? "accessory"}
                state={state}
              />
              <SelectField
                idPrefix={p}
                name="category"
                label="Kategorija opreme"
                required
                options={equipmentCategories.map((value) => ({ value, label: equipmentCategoryLabels[value] }))}
                defaultValue={product?.category ?? "patient_monitoring"}
                state={state}
              />
              <TextField
                idPrefix={p}
                name="manufacturerName"
                label="Proizvajalec"
                maxLength={120}
                defaultValue={product?.manufacturer_name ?? ""}
                state={state}
              />
              <TextField
                idPrefix={p}
                name="model"
                label="Model / oznaka"
                maxLength={120}
                defaultValue={product?.model ?? ""}
                state={state}
              />
              <div className="sm:col-span-2">
                <TextareaField
                  idPrefix={p}
                  name="description"
                  label="Opis"
                  maxLength={4000}
                  rows={3}
                  defaultValue={product?.description ?? ""}
                  state={state}
                />
              </div>
              <div className="sm:col-span-2">
                <TextareaField
                  idPrefix={p}
                  name="compatibility"
                  label="Združljivi modeli (ena vrstica: Proizvajalec | Model)"
                  rows={3}
                  defaultValue={
                    product?.compatibility.map((c) => `${c.manufacturer_name} | ${c.model}`).join("\n") ?? ""
                  }
                  hint="Uporablja se za priporočila: ujemanje s proizvajalcem in modelom opreme v registru ustanove."
                  state={state}
                />
              </div>
              <div className="sm:col-span-2">
                <TextareaField
                  idPrefix={p}
                  name="sources"
                  label="Viri (ena vrstica: Naslov | https://… | datum vpogleda)"
                  rows={3}
                  defaultValue={
                    product?.sources.map((s) => [s.title, s.url, s.retrieved_on ?? ""].join(" | ")).join("\n") ?? ""
                  }
                  state={state}
                />
              </div>
            </div>
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

export function ProductStatusButtons({
  organizationId,
  product,
}: {
  organizationId: string;
  product: EditableProduct;
}) {
  const targets =
    product.status === "draft" ? ["published"] : product.status === "published" ? ["archived"] : ["published"];
  return (
    <>
      {targets.map((target) => (
        <ConfirmAction
          key={target}
          variant={target === "published" ? "primary" : "danger"}
          label={target === "published" ? "Objavi" : "Arhiviraj"}
          title={target === "published" ? "Objava izdelka" : "Arhiviranje izdelka"}
          description={
            target === "published"
              ? "Izdelek bo viden vsem uporabnikom platforme in bo lahko vključen v priporočila."
              : "Izdelek ne bo več prikazan v katalogu in priporočilih."
          }
          confirmLabel="Potrdi"
          onConfirm={() => setProductStatusAction(organizationId, product.id, product.version, target)}
        />
      ))}
    </>
  );
}

export function PrivateNoteForm({
  organizationId,
  productId,
  body,
}: {
  organizationId: string;
  productId: string;
  body: string;
}) {
  const [state, action] = useActionState(savePrivateNoteAction.bind(null, organizationId, productId), idleState);
  return (
    <form action={action} className="space-y-2">
      <TextareaField
        idPrefix={`note-${productId}`}
        name="body"
        label="Interni zapisek (vidi ga samo vaša organizacija)"
        maxLength={4000}
        rows={2}
        defaultValue={body}
        state={state}
      />
      <ActionMessage state={state} />
      <SubmitButton size="sm" variant="secondary">
        Shrani zapisek
      </SubmitButton>
    </form>
  );
}

const feedbackLabels = {
  saved: "Shranjeno",
  dismissed: "Skrito",
  info_requested: "Povpraševanje poslano",
  reviewed: "Pregledano",
};

export function FeedbackButtons({
  organizationId,
  productId,
  ruleKey,
  status,
}: {
  organizationId: string;
  productId: string;
  ruleKey: string;
  status: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (next: "saved" | "dismissed" | "reviewed" | null) =>
    start(async () => {
      const result = await setFeedbackAction(organizationId, productId, ruleKey, next);
      setError(result.status === "error" ? (result.message ?? "Napaka.") : null);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status ? (
        <span className="text-xs text-ink-muted">
          {feedbackLabels[status as keyof typeof feedbackLabels] ?? status}
        </span>
      ) : null}
      {status !== "saved" ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("saved")}>
          Shrani
        </Button>
      ) : null}
      {status !== "reviewed" ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("reviewed")}>
          Pregledano
        </Button>
      ) : null}
      {status === "dismissed" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set(null)}>
          Ponovno prikaži
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("dismissed")}>
          Skrij
        </Button>
      )}
      {error ? (
        <span role="alert" className="text-xs text-danger-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function InquiryDialog({
  organizationId,
  product,
  ruleKey = null,
  equipment,
  defaultEquipmentIds = [],
}: {
  organizationId: string;
  product: { id: string; name: string; supplierId: string; supplierName: string };
  ruleKey?: string | null;
  equipment: { id: string; label: string }[];
  defaultEquipmentIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await createInquiryAction(
      organizationId,
      { id: product.id, supplierId: product.supplierId, ruleKey },
      previous,
      formData,
    );
    if (result.status === "success") setOpen(false);
    return result;
  }, idleState);
  const p = `inquiry-${product.id}-${ruleKey ?? "catalog"}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Pošlji povpraševanje
      </Button>
      {open ? (
        <DialogContent closeLabel="Zapri" className="max-w-xl">
          <DialogTitle>Povpraševanje: {product.name}</DialogTitle>
          <DialogDescription>
            Dobavitelj ({product.supplierName}) prejme sporočilo, ime vaše organizacije in samo podatke, ki jih spodaj
            izberete. Do vašega registra opreme nima dostopa.
          </DialogDescription>
          <form action={action} noValidate className="mt-5 space-y-4">
            <TextareaField idPrefix={p} name="message" label="Sporočilo" maxLength={2000} rows={4} state={state} />
            {equipment.length > 0 ? (
              <fieldset>
                <legend className="text-sm font-medium text-ink">
                  Deli podatke o opremi (naziv, kategorija, proizvajalec, model)
                </legend>
                <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                  {equipment.map((e) => (
                    <label key={e.id} className="flex items-start gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        name="equipmentIds"
                        value={e.id}
                        defaultChecked={defaultEquipmentIds.includes(e.id)}
                        className="mt-0.5 size-4 accent-[var(--color-accent-600)]"
                      />
                      {e.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" name="shareContact" className="mt-0.5 size-4 accent-[var(--color-accent-600)]" />
              Deli moje ime in e-poštni naslov za odgovor izven platforme
            </label>
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Prekliči
              </Button>
              <SubmitButton>Pošlji</SubmitButton>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function AnswerInquiryForm({ organizationId, inquiryId }: { organizationId: string; inquiryId: string }) {
  const [state, action] = useActionState(answerInquiryAction.bind(null, organizationId, inquiryId), idleState);
  return (
    <form action={action} noValidate className="space-y-2">
      <TextareaField
        idPrefix={`answer-${inquiryId}`}
        name="response"
        label="Odgovor"
        maxLength={4000}
        rows={3}
        state={state}
      />
      <ActionMessage state={state} />
      <SubmitButton size="sm">Pošlji odgovor</SubmitButton>
    </form>
  );
}

export function CloseInquiryButton({ organizationId, inquiryId }: { organizationId: string; inquiryId: string }) {
  return (
    <ConfirmAction
      variant="secondary"
      label="Zapri povpraševanje"
      title="Zaprtje povpraševanja"
      description="Povpraševanje bo označeno kot zaprto."
      confirmLabel="Zapri"
      onConfirm={() => closeInquiryAction(organizationId, inquiryId)}
    />
  );
}
