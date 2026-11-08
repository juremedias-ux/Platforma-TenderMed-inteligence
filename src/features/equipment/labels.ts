import type {
  DocumentOrigin,
  DocumentType,
  EquipmentCategory,
  EquipmentServiceStatus,
  MaintenanceActivityType,
  MaintenanceStatus,
  ScheduleBasis,
  ServiceEventType,
} from "@/types/domain";

/** Slovenian labels for equipment-related values. */

export const equipmentCategoryLabels: Record<EquipmentCategory, string> = {
  patient_monitoring: "Monitorji vitalnih funkcij",
  infusion: "Infuzijske črpalke",
  defibrillation: "Defibrilatorji",
  ultrasound_imaging: "Ultrazvočna diagnostika",
  sterilization: "Sterilizacija",
  physiotherapy: "Fizioterapevtska oprema",
  laboratory: "Laboratorijska oprema",
  ecg: "EKG",
  suction: "Aspiratorji",
};

export const activityTypeLabels: Record<MaintenanceActivityType, string> = {
  preventive_maintenance: "Preventivno vzdrževanje",
  inspection: "Varnostno-tehnični pregled",
  calibration: "Kalibracija",
};

export const serviceEventTypeLabels: Record<ServiceEventType, string> = {
  ...activityTypeLabels,
  repair: "Popravilo",
};

export const scheduleBasisLabels: Record<ScheduleBasis, string> = {
  manufacturer_instructions: "Navodila proizvajalca",
  organization_procedure: "Interni postopek ustanove",
  service_contract: "Servisna pogodba",
};

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  overdue: "Rok je potekel",
  due_soon: "Prihaja v 30 dneh",
  scheduled: "Načrtovano",
  no_due_date: "Rok ni določen",
};

export const equipmentStatusLabels: Record<EquipmentServiceStatus, string> = {
  overdue: "Zamuda",
  due_soon: "Prihaja v 30 dneh",
  ok: "V roku",
  not_scheduled: "Interval ni določen",
};

export const documentTypeLabels: Record<DocumentType, string> = {
  instructions_for_use: "Navodila za uporabo",
  instructions_for_use_sl: "Navodila za uporabo v slovenščini",
  service_report: "Servisno poročilo",
  calibration_report: "Kalibracijsko poročilo",
  warranty_certificate: "Garancijski list",
  acceptance_record: "Prevzemni zapisnik",
  compatibility_list: "Seznam združljive opreme",
  declaration_of_conformity: "Izjava o skladnosti",
  technical_datasheet: "Tehnični list",
  service_contract: "Servisna pogodba",
  service_references: "Reference za primerljiva dela",
};

export const documentOriginLabels: Record<DocumentOrigin, string> = {
  manufacturer: "Proizvajalec",
  service_partner: "Serviser",
  organization: "Ustanova",
  supplier: "Dobavitelj",
};
