import type { BadgeTone } from "@/components/ui/badge";

/** Service request vocabulary; mirrors 20261110120200_service_collaboration.sql. */

export const requestStatuses = [
  "novo",
  "v_usklajevanju",
  "termin_potrjen",
  "v_izvedbi",
  "caka_na_potrditev",
  "zakljuceno",
  "preklicano",
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const openStatuses: RequestStatus[] = [
  "novo",
  "v_usklajevanju",
  "termin_potrjen",
  "v_izvedbi",
  "caka_na_potrditev",
];

export const requestStatusLabels: Record<RequestStatus, string> = {
  novo: "Novo",
  v_usklajevanju: "V usklajevanju",
  termin_potrjen: "Termin potrjen",
  v_izvedbi: "V izvedbi",
  caka_na_potrditev: "Čaka na potrditev",
  zakljuceno: "Zaključeno",
  preklicano: "Preklicano",
};

export const requestStatusTones: Record<RequestStatus, BadgeTone> = {
  novo: "info",
  v_usklajevanju: "warning",
  termin_potrjen: "accent",
  v_izvedbi: "accent",
  caka_na_potrditev: "warning",
  zakljuceno: "success",
  preklicano: "outline",
};

export const requestTypes = ["preventive_maintenance", "inspection", "calibration", "repair", "other"] as const;
export type RequestType = (typeof requestTypes)[number];

export const requestTypeLabels: Record<RequestType, string> = {
  preventive_maintenance: "Preventivno vzdrževanje",
  inspection: "Varnostno-tehnični pregled",
  calibration: "Kalibracija",
  repair: "Popravilo",
  other: "Drugo",
};

export const priorities = ["normal", "urgent"] as const;
export type Priority = (typeof priorities)[number];
export const priorityLabels: Record<Priority, string> = { normal: "Običajna", urgent: "Nujno" };

export const replacementStatuses = ["not_needed", "requested", "arranged", "delivered", "returned"] as const;
export type ReplacementStatus = (typeof replacementStatuses)[number];

export const replacementStatusLabels: Record<ReplacementStatus, string> = {
  not_needed: "Ni potrebna",
  requested: "Zahtevana",
  arranged: "Dogovorjena",
  delivered: "Dostavljena",
  returned: "Vrnjena",
};

/** Allowed next replacement states (same rules as set_replacement_status). */
export const replacementTransitions: Record<ReplacementStatus, ReplacementStatus[]> = {
  not_needed: ["requested"],
  requested: ["arranged", "not_needed"],
  arranged: ["delivered", "not_needed"],
  delivered: ["returned"],
  returned: [],
};

export const outcomes = ["completed", "completed_with_findings", "not_completed"] as const;
export type Outcome = (typeof outcomes)[number];

export const outcomeLabels: Record<Outcome, string> = {
  completed: "Opravljeno",
  completed_with_findings: "Opravljeno, z ugotovitvami",
  not_completed: "Ni opravljeno",
};

export type AcknowledgmentStatus = "not_required" | "pending" | "acknowledged" | "rejected";

export const acknowledgmentLabels: Record<AcknowledgmentStatus, string> = {
  not_required: "Potrditev ni potrebna",
  pending: "Čaka na potrditev ustanove",
  acknowledged: "Potrjeno",
  rejected: "Zavrnjeno",
};

export const proposalStatusLabels: Record<string, string> = {
  proposed: "Predlagano",
  accepted: "Sprejeto",
  declined: "Zavrnjeno",
  withdrawn: "Umaknjeno",
  superseded: "Nadomeščeno",
};

export type Actor = "operator" | "assignee" | "viewer";

/** Status transitions a caller may request (the database enforces the same rules). */
export function availableTransitions(status: RequestStatus, actor: Actor): RequestStatus[] {
  if (status === "zakljuceno" || status === "preklicano" || actor === "viewer") return [];
  const result: RequestStatus[] = [];
  if (actor === "operator" && status === "novo") result.push("v_usklajevanju");
  if (status === "termin_potrjen") result.push("v_izvedbi");
  if (status === "termin_potrjen" || status === "v_izvedbi") result.push("v_usklajevanju");
  if (actor === "operator" && (status === "v_izvedbi" || status === "caka_na_potrditev")) result.push("zakljuceno");
  if (actor === "operator") result.push("preklicano");
  return result;
}

export const transitionLabels: Partial<Record<RequestStatus, string>> = {
  v_usklajevanju: "Začni usklajevanje",
  v_izvedbi: "Začni izvedbo",
  zakljuceno: "Zaključi zahtevek",
  preklicano: "Prekliči zahtevek",
};

export function describeEvent(type: string, from: string | null, to: string | null): string {
  const label = (status: string | null) =>
    status && status in requestStatusLabels ? requestStatusLabels[status as RequestStatus] : (status ?? "");
  const replacement = (status: string | null) =>
    status && status in replacementStatusLabels ? replacementStatusLabels[status as ReplacementStatus] : (status ?? "");
  switch (type) {
    case "created":
      return "Zahtevek ustvarjen";
    case "status_changed":
      return `Status: ${label(from)} → ${label(to)}`;
    case "appointment_proposed":
      return "Predlagan termin";
    case "appointment_accepted":
      return "Termin sprejet";
    case "appointment_declined":
      return "Termin zavrnjen";
    case "appointment_withdrawn":
      return "Predlog termina umaknjen";
    case "completion_recorded":
      return "Zabeležena izvedba";
    case "completion_acknowledged":
      return "Izvedba potrjena";
    case "completion_rejected":
      return "Izvedba zavrnjena";
    case "completion_voided":
      return "Zapis o izvedbi razveljavljen";
    case "replacement_changed":
      return `Nadomestna oprema: ${replacement(from)} → ${replacement(to)}`;
    case "document_added":
      return "Dodan dokument";
    case "assignee_added":
      return "Dodan zunanji sodelavec";
    case "assignee_revoked":
      return "Odvzet dostop zunanjemu sodelavcu";
    default:
      return type;
  }
}
