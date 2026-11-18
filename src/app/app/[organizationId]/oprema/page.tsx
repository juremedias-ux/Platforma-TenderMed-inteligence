import { Download, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DueBadge, DueDate, EquipmentStatusBadge } from "@/components/app/equipment/badges";
import { CreateEquipmentDialog } from "@/components/app/equipment/equipment-forms";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { ljubljanaDate } from "@/lib/dates/datetime";
import {
  equipmentCategories,
  equipmentCategoryLabels,
  equipmentStatuses,
  equipmentStatusLabels,
} from "@/lib/equipment/domain";
import {
  EQUIPMENT_PAGE_SIZE,
  listEquipment,
  listLocations,
  listMemberOptions,
  parseEquipmentFilters,
  type EquipmentFilters,
} from "@/lib/repositories/equipment";

export const metadata: Metadata = { title: "Oprema" };

type Props = PageProps<"/app/[organizationId]/oprema">;

function pageHref(organizationId: string, filters: EquipmentFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "current") params.set("status", filters.status);
  if (filters.category) params.set("kategorija", filters.category);
  if (filters.locationId) params.set("lokacija", filters.locationId);
  if (page > 1) params.set("stran", String(page));
  const query = params.toString();
  return `/app/${organizationId}/oprema${query ? `?${query}` : ""}`;
}

async function EquipmentList({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/oprema`);
  if (!context) return <NoAccess />;
  const { supabase, role } = context;
  const filters = parseEquipmentFilters(await searchParams);
  const canManage = can(role, "equipment.manage");

  let data;
  try {
    const [list, locations, members] = await Promise.all([
      listEquipment(supabase, organizationId, filters),
      listLocations(supabase, organizationId, true),
      canManage ? listMemberOptions(supabase, organizationId) : Promise.resolve([]),
    ]);
    data = { list, locations, members };
  } catch {
    return <LoadError />;
  }
  const { list, locations, members } = data;
  const today = ljubljanaDate();
  const filtered = Boolean(filters.q || filters.category || filters.locationId || filters.status !== "current");
  const pages = Math.max(1, Math.ceil(list.total / EQUIPMENT_PAGE_SIZE));
  const activeLocations = locations.filter((l) => !l.archived_at).map((l) => ({ id: l.id, name: l.name }));

  return (
    <>
      <PageHeader
        title="Oprema"
        description="Register medicinske opreme organizacije z roki servisnih načrtov."
        actions={
          <>
            {can(role, "equipment.export") ? (
              <a href={`/app/${organizationId}/oprema/izvoz`} className={buttonVariants({ variant: "secondary" })}>
                <Download aria-hidden="true" />
                Izvoz CSV
              </a>
            ) : null}
            {can(role, "equipment.import") ? (
              <Link href={`/app/${organizationId}/oprema/uvoz`} className={buttonVariants({ variant: "secondary" })}>
                <Upload aria-hidden="true" />
                Uvoz CSV
              </Link>
            ) : null}
            {canManage ? (
              <CreateEquipmentDialog organizationId={organizationId} locations={activeLocations} members={members} />
            ) : null}
          </>
        }
      />

      <form
        method="get"
        role="search"
        aria-label="Iskanje opreme"
        className="mb-5 grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_12rem_14rem_12rem_auto] lg:items-end"
      >
        <div>
          <Label htmlFor="filter-q">Iskanje</Label>
          <Input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Naziv, inventarna ali serijska številka"
            className="mt-1.5 h-10"
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="filter-status">Status</Label>
          <Select
            id="filter-status"
            name="status"
            defaultValue={filters.status === "current" ? "" : filters.status}
            className="mt-1.5"
          >
            <option value="">V evidenci (brez arhiva)</option>
            {equipmentStatuses.map((s) => (
              <option key={s} value={s}>
                {equipmentStatusLabels[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-category">Kategorija</Label>
          <Select id="filter-category" name="kategorija" defaultValue={filters.category ?? ""} className="mt-1.5">
            <option value="">Vse kategorije</option>
            {equipmentCategories.map((c) => (
              <option key={c} value={c}>
                {equipmentCategoryLabels[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-location">Lokacija</Label>
          <Select id="filter-location" name="lokacija" defaultValue={filters.locationId ?? ""} className="mt-1.5">
            <option value="">Vse lokacije</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.archived_at ? " (arhivirana)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonVariants({ variant: "primary" })}>
            Prikaži
          </button>
          {filtered ? (
            <Link href={`/app/${organizationId}/oprema`} className={buttonVariants({ variant: "ghost" })}>
              Počisti
            </Link>
          ) : null}
        </div>
      </form>

      {list.rows.length === 0 ? (
        filtered ? (
          <StateMessage kind="empty" title="Ni zadetkov">
            Nobena oprema ne ustreza izbranim filtrom.
          </StateMessage>
        ) : (
          <StateMessage kind="empty" title="V registru še ni opreme">
            {canManage
              ? "Dodajte prvo opremo ali uvozite obstoječi seznam iz datoteke CSV."
              : "Ko bo upravljavec opreme dodal opremo, bo prikazana tukaj."}
          </StateMessage>
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              Seznam opreme ({list.total}); stran {filters.page} od {pages}
            </caption>
            <thead className="border-b border-line bg-subtle text-xs text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Oprema
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Lokacija
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Naslednji rok
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Stanje roka
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link
                      href={`/app/${organizationId}/oprema/${row.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {[
                        row.asset_tag,
                        equipmentCategoryLabels[row.category],
                        [row.manufacturer_name, row.model].filter(Boolean).join(" "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-ink-soft">{row.location_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <EquipmentStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DueDate nextDue={row.next_due_date} today={today} />
                  </td>
                  <td className="px-4 py-3">
                    {row.next_due_date ? (
                      <DueBadge nextDue={row.next_due_date} today={today} archived={row.status === "archived"} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Strani" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Stran {filters.page} od {pages} · skupaj {list.total}
          </span>
          <span className="flex gap-2">
            {filters.page > 1 ? (
              <Link
                href={pageHref(organizationId, filters, filters.page - 1)}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Prejšnja
              </Link>
            ) : null}
            {filters.page < pages ? (
              <Link
                href={pageHref(organizationId, filters, filters.page + 1)}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Naslednja
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}

export default function EquipmentPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam opremo …</p>}>
      <EquipmentList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
