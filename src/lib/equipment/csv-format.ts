import { CsvError, parseCsv, restoreNeutralized, toCsv } from "@/lib/csv/csv";
import { isValidIsoDate, type IsoDate } from "@/lib/dates/date-only";
import {
  equipmentCategories,
  equipmentCategoryLabels,
  equipmentStatusLabels,
  type EquipmentCategory,
  type EquipmentStatus,
} from "./domain";

/**
 * Fixed CSV format for the equipment register (import and export).
 * Import is all-or-nothing: any row error blocks the whole file.
 */

export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_IMPORT_ROWS = 500;
const MAX_REPORTED_ERRORS = 50;

export const equipmentCsvColumns = [
  { key: "asset_tag", header: "inventarna_stevilka", max: 64 },
  { key: "name", header: "naziv", required: true, max: 160 },
  { key: "category", header: "kategorija", required: true },
  { key: "manufacturer_name", header: "proizvajalec", max: 120 },
  { key: "model", header: "model", max: 120 },
  { key: "serial_number", header: "serijska_stevilka", max: 120 },
  { key: "location", header: "lokacija", max: 120 },
  { key: "purchase_date", header: "datum_nakupa", date: true },
  { key: "commissioning_date", header: "datum_zagona", date: true },
  { key: "warranty_end_date", header: "garancija_do", date: true },
  { key: "status", header: "status" },
  { key: "notes", header: "opombe", max: 4000 },
] as const;

/** Columns written by the export that the import ignores (round trip). */
const EXPORT_ONLY_HEADERS = ["naslednji_rok"];

type ColumnKey = (typeof equipmentCsvColumns)[number]["key"];

export interface EquipmentImportRow {
  asset_tag: string | null;
  name: string;
  category: EquipmentCategory;
  manufacturer_name: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  purchase_date: IsoDate | null;
  commissioning_date: IsoDate | null;
  warranty_end_date: IsoDate | null;
  status: Exclude<EquipmentStatus, "archived">;
  notes: string | null;
}

export interface ImportIssue {
  line: number;
  column?: string;
  message: string;
}

export interface ImportValidation {
  rows: EquipmentImportRow[];
  issues: ImportIssue[];
  /** Total issues found (issues is truncated to the first 50). */
  issueCount: number;
}

export interface ExistingIdentifiers {
  assetTags: ReadonlySet<string>;
  /** `${lower(manufacturer)}|${lower(serial)}` */
  serials: ReadonlySet<string>;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const categoryLookup = new Map<string, EquipmentCategory>(
  equipmentCategories.flatMap((code) => [
    [normalizeKey(code), code],
    [normalizeKey(equipmentCategoryLabels[code]), code],
  ]),
);

const importStatuses = ["active", "in_service", "temporarily_out"] as const;
const statusLookup = new Map<string, (typeof importStatuses)[number]>(
  importStatuses.flatMap((code) => [
    [normalizeKey(code), code],
    [normalizeKey(equipmentStatusLabels[code]), code],
  ]),
);

/** Accepts YYYY-MM-DD or the Slovenian D.M.YYYY (spaces allowed). */
export function parseImportDate(value: string): IsoDate | null {
  const trimmed = value.trim();
  if (isValidIsoDate(trimmed)) return trimmed;
  const match = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function serialKey(manufacturer: string | null, serial: string): string {
  return `${(manufacturer ?? "").toLowerCase()}|${serial.toLowerCase()}`;
}

export function validateEquipmentCsv(text: string, existing: ExistingIdentifiers): ImportValidation {
  const issues: ImportIssue[] = [];
  let issueCount = 0;
  const report = (issue: ImportIssue) => {
    issueCount += 1;
    if (issues.length < MAX_REPORTED_ERRORS) issues.push(issue);
  };

  let parsed: string[][];
  try {
    parsed = parseCsv(text).rows;
  } catch (error) {
    const message = error instanceof CsvError ? error.message : "Datoteke ni mogoče prebrati kot CSV.";
    return { rows: [], issues: [{ line: 1, message }], issueCount: 1 };
  }

  const [header, ...dataRows] = parsed;
  if (!header) return { rows: [], issues: [{ line: 1, message: "Datoteka je prazna." }], issueCount: 1 };

  const columnIndex = new Map<ColumnKey, number>();
  header.forEach((raw, index) => {
    const key = normalizeKey(raw);
    if (!key) return;
    const column = equipmentCsvColumns.find((c) => c.header === key);
    if (column) {
      if (columnIndex.has(column.key)) report({ line: 1, column: raw, message: "Stolpec se ponovi." });
      columnIndex.set(column.key, index);
    } else if (!EXPORT_ONLY_HEADERS.includes(key)) {
      report({ line: 1, column: raw, message: "Neznan stolpec. Uporabite predlogo za uvoz." });
    }
  });
  for (const column of equipmentCsvColumns) {
    if ("required" in column && column.required && !columnIndex.has(column.key)) {
      report({ line: 1, column: column.header, message: "Manjka obvezen stolpec." });
    }
  }
  if (issueCount > 0) return { rows: [], issues, issueCount };

  if (dataRows.length === 0)
    return { rows: [], issues: [{ line: 2, message: "Datoteka nima vrstic z opremo." }], issueCount: 1 };
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      issues: [{ line: 1, message: `Uvozite lahko največ ${MAX_IMPORT_ROWS} vrstic naenkrat.` }],
      issueCount: 1,
    };
  }

  const seenTags = new Set<string>();
  const seenSerials = new Set<string>();
  const rows: EquipmentImportRow[] = [];

  dataRows.forEach((cells, index) => {
    const line = index + 2;
    const cell = (key: ColumnKey): string | null => {
      const position = columnIndex.get(key);
      if (position === undefined) return null;
      const value = restoreNeutralized((cells[position] ?? "").replace(/\s+/g, " ").trim());
      return value === "" ? null : value;
    };
    const rowIssues: ImportIssue[] = [];
    const issue = (column: string, message: string) => rowIssues.push({ line, column, message });

    for (const column of equipmentCsvColumns) {
      const value = cell(column.key);
      if ("max" in column && value && value.length > column.max) {
        issue(column.header, `Največ ${column.max} znakov.`);
      }
    }

    const name = cell("name");
    if (!name || name.length < 2) issue("naziv", "Vpišite naziv opreme (vsaj 2 znaka).");

    const categoryRaw = cell("category");
    const category = categoryRaw ? categoryLookup.get(normalizeKey(categoryRaw)) : undefined;
    if (!category) issue("kategorija", "Neveljavna kategorija. Uporabite kodo ali ime iz predloge.");

    const statusRaw = cell("status");
    const status = statusRaw ? statusLookup.get(normalizeKey(statusRaw)) : "active";
    if (!status) issue("status", "Neveljaven status (V uporabi, Na servisu, Začasno izven uporabe).");

    const dates: Partial<Record<ColumnKey, IsoDate | null>> = {};
    for (const column of equipmentCsvColumns) {
      if (!("date" in column)) continue;
      const raw = cell(column.key);
      const value = raw ? parseImportDate(raw) : null;
      if (raw && !value) issue(column.header, "Datum mora biti v obliki 2026-01-31 ali 31. 1. 2026.");
      dates[column.key] = value;
    }

    const assetTag = cell("asset_tag");
    if (assetTag) {
      const key = assetTag.toLowerCase();
      if (existing.assetTags.has(key)) issue("inventarna_stevilka", "Oprema s to inventarno številko že obstaja.");
      else if (seenTags.has(key)) issue("inventarna_stevilka", "Inventarna številka se v datoteki ponovi.");
      seenTags.add(key);
    }
    const manufacturer = cell("manufacturer_name");
    const serial = cell("serial_number");
    if (serial) {
      const key = serialKey(manufacturer, serial);
      if (existing.serials.has(key)) issue("serijska_stevilka", "Oprema s to serijsko številko že obstaja.");
      else if (seenSerials.has(key)) issue("serijska_stevilka", "Serijska številka se v datoteki ponovi.");
      seenSerials.add(key);
    }

    if (rowIssues.length > 0 || !name || !category || !status) {
      rowIssues.forEach(report);
      return;
    }
    rows.push({
      asset_tag: assetTag,
      name,
      category,
      manufacturer_name: manufacturer,
      model: cell("model"),
      serial_number: serial,
      location: cell("location"),
      purchase_date: dates.purchase_date ?? null,
      commissioning_date: dates.commissioning_date ?? null,
      warranty_end_date: dates.warranty_end_date ?? null,
      status,
      notes: cell("notes"),
    });
  });

  return issueCount > 0 ? { rows: [], issues, issueCount } : { rows, issues: [], issueCount: 0 };
}

export interface EquipmentExportRow {
  asset_tag: string | null;
  name: string;
  category: string;
  manufacturer_name: string | null;
  model: string | null;
  serial_number: string | null;
  location_name: string | null;
  purchase_date: string | null;
  commissioning_date: string | null;
  warranty_end_date: string | null;
  status: string;
  notes: string | null;
  next_due_date: string | null;
}

export function equipmentToCsv(rows: readonly EquipmentExportRow[]): string {
  const header = [...equipmentCsvColumns.map((c) => c.header), ...EXPORT_ONLY_HEADERS];
  return toCsv([
    header,
    ...rows.map((row) => [
      row.asset_tag,
      row.name,
      row.category,
      row.manufacturer_name,
      row.model,
      row.serial_number,
      row.location_name,
      row.purchase_date,
      row.commissioning_date,
      row.warranty_end_date,
      row.status,
      row.notes,
      row.next_due_date,
    ]),
  ]);
}

/** Header-only template: no sample rows, so nothing fictional can be imported by accident. */
export function equipmentCsvTemplate(): string {
  return toCsv([equipmentCsvColumns.map((c) => c.header)]);
}
