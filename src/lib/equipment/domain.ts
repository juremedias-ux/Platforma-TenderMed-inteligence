/**
 * Platform equipment vocabulary. Values mirror the CHECK constraints in
 * supabase/migrations/20261110120100_equipment.sql; the public demo keeps its
 * own types in src/types/domain.ts.
 */

export const equipmentCategories = [
  "patient_monitoring",
  "infusion",
  "defibrillation",
  "ultrasound_imaging",
  "radiology_imaging",
  "sterilization",
  "physiotherapy",
  "laboratory",
  "ecg",
  "suction",
  "ventilation",
  "other",
] as const;
export type EquipmentCategory = (typeof equipmentCategories)[number];

export const equipmentCategoryLabels: Record<EquipmentCategory, string> = {
  patient_monitoring: "Monitorji vitalnih funkcij",
  infusion: "Infuzijske črpalke",
  defibrillation: "Defibrilatorji",
  ultrasound_imaging: "Ultrazvočna diagnostika",
  radiology_imaging: "Radiološka diagnostika",
  sterilization: "Sterilizacija",
  physiotherapy: "Fizioterapevtska oprema",
  laboratory: "Laboratorijska oprema",
  ecg: "EKG",
  suction: "Aspiratorji",
  ventilation: "Ventilacija",
  other: "Drugo",
};

export const equipmentStatuses = ["active", "in_service", "temporarily_out", "archived"] as const;
export type EquipmentStatus = (typeof equipmentStatuses)[number];

export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  active: "V uporabi",
  in_service: "Na servisu",
  temporarily_out: "Začasno izven uporabe",
  archived: "Arhivirano",
};

export const activityTypes = ["preventive_maintenance", "inspection", "calibration", "other"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const activityTypeLabels: Record<ActivityType, string> = {
  preventive_maintenance: "Preventivno vzdrževanje",
  inspection: "Varnostno-tehnični pregled",
  calibration: "Kalibracija",
  other: "Drugo",
};

export const scheduleModes = ["fixed_calendar", "after_completion", "one_off"] as const;
export type ScheduleMode = (typeof scheduleModes)[number];

export const scheduleModeLabels: Record<ScheduleMode, string> = {
  fixed_calendar: "Fiksni koledar",
  after_completion: "Po zadnji izvedbi",
  one_off: "Enkratni rok",
};

export const scheduleModeDescriptions: Record<ScheduleMode, string> = {
  fixed_calendar:
    "Roki sledijo koledarju od začetnega datuma (npr. vsak januar). Izvedba pokrije najzgodnejši odprt rok; zamujeni roki se ne seštevajo.",
  after_completion: "Naslednji rok se računa od datuma zadnje potrjene izvedbe. Pred prvo izvedbo velja začetni datum.",
  one_off: "Ena aktivnost z enim rokom. Po potrjeni izvedbi je načrt opravljen.",
};

export const sourceBases = [
  "manufacturer_instructions",
  "organization_procedure",
  "service_contract",
  "legal_requirement",
  "other",
] as const;
export type SourceBasis = (typeof sourceBases)[number];

export const sourceBasisLabels: Record<SourceBasis, string> = {
  manufacturer_instructions: "Navodila proizvajalca",
  organization_procedure: "Interni postopek ustanove",
  service_contract: "Servisna pogodba",
  legal_requirement: "Predpis",
  other: "Drugo",
};

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
