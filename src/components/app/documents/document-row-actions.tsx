"use client";

import { updateDocumentAction } from "@/app/app/document-actions";
import { ConfirmAction } from "@/components/app/confirm-action";

export function DocumentRowActions({
  documentId,
  version,
  shared,
  canShare,
}: {
  documentId: string;
  version: number;
  shared: boolean;
  canShare: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      {canShare ? (
        <ConfirmAction
          variant="secondary"
          label={shared ? "Ne deli" : "Deli s serviserjem"}
          title={shared ? "Prekinitev deljenja" : "Deljenje s serviserjem"}
          description={
            shared
              ? "Zunanji serviser dokumenta ne bo več videl."
              : "Zunanji serviser tega zahtevka bo lahko prenesel ta dokument."
          }
          confirmLabel="Potrdi"
          onConfirm={() => updateDocumentAction(documentId, version, { shared: !shared })}
        />
      ) : null}
      <ConfirmAction
        label="Arhiviraj"
        title="Arhiviranje dokumenta"
        description="Dokument ne bo več prikazan. Datoteka ostane shranjena in zabeležena v revizijski sledi."
        confirmLabel="Arhiviraj"
        onConfirm={() => updateDocumentAction(documentId, version, { archived: true })}
      />
    </div>
  );
}
