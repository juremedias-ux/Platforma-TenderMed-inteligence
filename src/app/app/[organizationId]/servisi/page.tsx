import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PriorityBadge, RequestStatusBadge } from "@/components/app/service/badges";
import { CreateRequestDialog } from "@/components/app/service/request-forms";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { formatDateTime, formatDateTimeRange as formatRange } from "@/lib/dates/datetime";
import { listEquipmentChoices, listRequests, parseRequestFilters } from "@/lib/repositories/service";
import { requestStatuses, requestStatusLabels, requestTypeLabels } from "@/lib/service/domain";
import { planLabel } from "@/lib/service/plan-label";

export const metadata: Metadata = { title: "Servisi" };

type Props = PageProps<"/app/[organizationId]/servisi">;

async function RequestList({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/servisi`);
  if (!context) return <NoAccess />;
  const { supabase, role } = context;
  const filters = parseRequestFilters(await searchParams);
  const canCreate = can(role, "service.create");

  let loaded;
  try {
    const [rows, equipment] = await Promise.all([
      listRequests(supabase, organizationId, filters),
      canCreate ? listEquipmentChoices(supabase, organizationId, planLabel) : Promise.resolve([]),
    ]);
    loaded = { rows, equipment };
  } catch {
    return <LoadError />;
  }
  const { rows, equipment } = loaded;
  const filtered = filters.view !== "open" || Boolean(filters.q) || Boolean(filters.equipmentId);

  return (
    <>
      <PageHeader
        title="Servisi"
        description="Servisni zahtevki, usklajevanje terminov z zunanjimi serviserji in zapisi o izvedbi."
        actions={
          canCreate && equipment.length > 0 ? (
            <CreateRequestDialog
              organizationId={organizationId}
              equipment={equipment}
              defaultEquipmentId={filters.equipmentId ?? undefined}
            />
          ) : null
        }
      />
      <form
        method="get"
        role="search"
        aria-label="Iskanje zahtevkov"
        className="mb-5 grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_14rem_auto] sm:items-end"
      >
        <div>
          <Label htmlFor="filter-q">Iskanje</Label>
          <Input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Naslov ali številka zahtevka"
            maxLength={80}
            className="mt-1.5 h-10"
          />
        </div>
        <div>
          <Label htmlFor="filter-view">Prikaz</Label>
          <Select id="filter-view" name="prikaz" defaultValue={filters.view} className="mt-1.5">
            <option value="open">Odprti zahtevki</option>
            <option value="closed">Zaključeni in preklicani</option>
            <option value="all">Vsi</option>
            {requestStatuses.map((status) => (
              <option key={status} value={status}>
                {requestStatusLabels[status]}
              </option>
            ))}
          </Select>
        </div>
        {filters.equipmentId ? <input type="hidden" name="oprema" value={filters.equipmentId} /> : null}
        <div className="flex gap-2">
          <button type="submit" className={buttonVariants({ variant: "primary" })}>
            Prikaži
          </button>
          {filtered ? (
            <Link href={`/app/${organizationId}/servisi`} className={buttonVariants({ variant: "ghost" })}>
              Počisti
            </Link>
          ) : null}
        </div>
      </form>

      {canCreate && equipment.length === 0 ? (
        <StateMessage kind="empty" title="Najprej dodajte opremo" className="mb-5">
          Servisni zahtevek se vedno nanaša na opremo iz registra.
        </StateMessage>
      ) : null}

      {rows.length === 0 ? (
        <StateMessage kind="empty" title={filtered ? "Ni zadetkov" : "Ni odprtih zahtevkov"}>
          {filtered ? "Noben zahtevek ne ustreza izbranim filtrom." : "Odprti servisni zahtevki bodo prikazani tukaj."}
        </StateMessage>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface shadow-card">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link
                  href={`/app/${organizationId}/servisi/${row.id}`}
                  className="font-medium text-ink underline-offset-2 hover:underline"
                >
                  #{row.reference_number} {row.title}
                </Link>
                <p className="text-sm text-ink-soft">
                  {row.equipment_name ?? "Oprema"} · {requestTypeLabels[row.request_type]} · odprto{" "}
                  {formatDateTime(row.created_at)}
                </p>
                {row.scheduled_start && row.scheduled_end ? (
                  <p className="text-xs text-ink-muted">
                    Termin: {formatRange(row.scheduled_start, row.scheduled_end)}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <PriorityBadge priority={row.priority} />
                <RequestStatusBadge status={row.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ServicePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam zahtevke …</p>}>
      <RequestList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
