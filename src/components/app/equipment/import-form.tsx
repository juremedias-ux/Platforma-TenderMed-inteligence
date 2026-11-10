"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  confirmImportAction,
  previewImportAction,
  type ImportPreviewState,
} from "@/app/app/[organizationId]/oprema/actions";
import { ActionMessage, SubmitButton } from "@/components/app/form-ui";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { equipmentCategoryLabels, isOneOf, equipmentCategories } from "@/lib/equipment/domain";

const idle: ImportPreviewState = { status: "idle" };

function Issues({ state }: { state: ImportPreviewState }) {
  if (!state.issues?.length) return null;
  return (
    <div className="rounded-md border border-danger-200 bg-surface">
      <p className="border-b border-danger-200 bg-danger-50 px-4 py-2 text-sm font-medium text-danger-700">
        Napake ({state.issueCount}
        {state.issueCount && state.issueCount > state.issues.length ? `, prikazanih ${state.issues.length}` : ""})
      </p>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
        {state.issues.map((issue, index) => (
          <li key={index} className="flex gap-3 px-4 py-2">
            <span className="w-20 shrink-0 text-ink-muted tabular-nums">vrstica {issue.line}</span>
            <span>
              {issue.column ? <span className="font-medium text-ink">{issue.column}: </span> : null}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportForm({ organizationId }: { organizationId: string }) {
  const [preview, previewAction] = useActionState(previewImportAction.bind(null, organizationId), idle);
  const [result, confirmAction] = useActionState(confirmImportAction.bind(null, organizationId), idle);

  if (result.status === "success") {
    return (
      <div className="space-y-4">
        <ActionMessage state={result} />
        <Link href={`/app/${organizationId}/oprema`} className={buttonVariants({ variant: "primary" })}>
          Na seznam opreme
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={previewAction} className="space-y-4">
        <div>
          <Label htmlFor="import-file">Datoteka CSV (največ 1 MB, 500 vrstic)</Label>
          <Input
            id="import-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1.5 h-auto py-2.5"
          />
        </div>
        <SubmitButton variant="secondary" pendingLabel="Preverjam …">
          Preveri datoteko
        </SubmitButton>
      </form>

      <ActionMessage state={preview} />
      <Issues state={preview} />

      {preview.status === "success" && preview.csv ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left text-sm">
              <caption className="px-4 py-2 text-left text-xs text-ink-muted">
                Prvih {preview.preview?.length} od {preview.rowCount} vrstic ({preview.fileName})
              </caption>
              <thead className="border-y border-line bg-subtle text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Naziv
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Kategorija
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Inventarna št.
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Lokacija
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.preview?.map((row, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2">
                      {isOneOf(equipmentCategories, row.category)
                        ? equipmentCategoryLabels[row.category]
                        : row.category}
                    </td>
                    <td className="px-4 py-2">{row.assetTag ?? "—"}</td>
                    <td className="px-4 py-2">{row.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={confirmAction} className="space-y-3">
            <input type="hidden" name="csv" value={preview.csv} />
            <p className="text-sm text-ink-soft">
              Uvoz je enoten: uvožene bodo vse vrstice ali nobena. Manjkajoče lokacije bodo ustvarjene.
            </p>
            <ActionMessage state={result} />
            <Issues state={result} />
            <SubmitButton pendingLabel="Uvažam …">Uvozi {preview.rowCount} vrstic</SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
