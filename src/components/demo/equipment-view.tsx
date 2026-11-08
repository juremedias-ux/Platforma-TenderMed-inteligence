"use client";

import { ChevronRight, Search } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { equipmentCategoryLabels, equipmentStatusLabels } from "@/features/equipment/labels";
import {
  emptyEquipmentFilters,
  filterEquipmentRows,
  getEquipmentRows,
  type EquipmentFilters,
} from "@/features/demo/selectors";
import { pluralSl } from "@/lib/utils/plural";
import type { EquipmentCategory, EquipmentServiceStatus } from "@/types/domain";
import { useDemo } from "./demo-context";
import { DateWithRelative, EmptyState, SerialNumber } from "./demo-shared";
import { EquipmentStatusBadge } from "./status-badges";

export function EquipmentView({
  filters,
  onFiltersChange,
}: {
  filters: EquipmentFilters;
  onFiltersChange: (filters: EquipmentFilters) => void;
}) {
  const id = useId();
  const { snapshot, state, openEquipment } = useDemo();
  const { dataset } = snapshot;
  const rows = getEquipmentRows(dataset, state);
  const visible = filterEquipmentRows(rows, filters);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(emptyEquipmentFilters);
  const categories = [...new Set(dataset.equipment.map((e) => e.category))];

  const set = <K extends keyof EquipmentFilters>(key: K, value: EquipmentFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_auto] xl:items-end">
        <div>
          <Label htmlFor={`${id}-iskanje`} className="text-[13px]">
            Iskanje
          </Label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <Input
              id={`${id}-iskanje`}
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Naziv, model, serijska številka …"
              className="h-10 pl-9 text-sm"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`${id}-kategorija`} className="text-[13px]">
            Kategorija
          </Label>
          <Select
            id={`${id}-kategorija`}
            className="mt-1.5"
            value={filters.category}
            onChange={(e) => set("category", e.target.value as EquipmentCategory | "all")}
          >
            <option value="all">Vse kategorije</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {equipmentCategoryLabels[category]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-lokacija`} className="text-[13px]">
            Lokacija
          </Label>
          <Select
            id={`${id}-lokacija`}
            className="mt-1.5"
            value={filters.locationId}
            onChange={(e) => set("locationId", e.target.value)}
          >
            <option value="all">Vse lokacije</option>
            {dataset.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-stanje`} className="text-[13px]">
            Servisno stanje
          </Label>
          <Select
            id={`${id}-stanje`}
            className="mt-1.5"
            value={filters.status}
            onChange={(e) => set("status", e.target.value as EquipmentServiceStatus | "all")}
          >
            <option value="all">Vsa stanja</option>
            {(Object.keys(equipmentStatusLabels) as EquipmentServiceStatus[]).map((status) => (
              <option key={status} value={status}>
                {equipmentStatusLabels[status]}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="ghost"
          size="md"
          onClick={() => onFiltersChange(emptyEquipmentFilters)}
          disabled={!filtersActive}
        >
          Počisti filtre
        </Button>
      </div>

      <p className="text-sm text-ink-muted" role="status" aria-live="polite">
        Prikaz: {visible.length} od {rows.length} {pluralSl(rows.length, ["naprave", "naprav", "naprav", "naprav"])}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="Ni naprav, ki ustrezajo izbranim filtrom."
          text="Spremenite iskalni niz ali počistite filtre."
          action={
            <Button variant="secondary" size="sm" onClick={() => onFiltersChange(emptyEquipmentFilters)}>
              Počisti filtre
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Evidenca opreme (izmišljeni podatki)</caption>
              <thead className="border-b border-line bg-subtle text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Naprava
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Lokacija
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Naslednji rok
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Servisno stanje
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Dejanja</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((row) => (
                  <tr key={row.equipment.id} className="transition-colors hover:bg-subtle/60">
                    <th scope="row" className="px-4 py-3 align-top font-normal">
                      <span className="block font-medium text-ink">
                        {row.equipment.name} {row.equipment.model}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {row.manufacturerName} · <SerialNumber>{row.equipment.serialNumber}</SerialNumber>
                      </span>
                    </th>
                    <td className="px-4 py-3 align-top text-ink-soft">{row.locationName}</td>
                    <td className="px-4 py-3 align-top text-ink-soft">
                      <DateWithRelative date={row.nextDueDate} reference={state.referenceDate} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        <EquipmentStatusBadge status={row.status} size="sm" />
                        {row.openRequestCount > 0 ? (
                          <span className="text-xs text-ink-muted">Odprti zahtevki: {row.openRequestCount}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEquipment(row.equipment.id)}
                        aria-label={`Podrobnosti: ${row.equipment.name} ${row.equipment.model}, ${row.equipment.serialNumber}`}
                      >
                        Podrobnosti
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="space-y-3 md:hidden" aria-label="Evidenca opreme (izmišljeni podatki)">
            {visible.map((row) => (
              <li key={row.equipment.id} className="rounded-lg border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {row.equipment.name} {row.equipment.model}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      <SerialNumber>{row.equipment.serialNumber}</SerialNumber>
                    </p>
                  </div>
                  <EquipmentStatusBadge status={row.status} size="sm" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-muted">Lokacija</dt>
                    <dd className="text-ink-soft">{row.locationName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Naslednji rok</dt>
                    <dd className="text-ink-soft">
                      <DateWithRelative date={row.nextDueDate} reference={state.referenceDate} />
                    </dd>
                  </div>
                </dl>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => openEquipment(row.equipment.id)}
                  aria-label={`Podrobnosti: ${row.equipment.name} ${row.equipment.model}, ${row.equipment.serialNumber}`}
                >
                  Podrobnosti
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
