import type { IssueCategory, ServiceRequestStatus, ServiceRequestUrgency, TimelineActor } from "@/types/domain";

export const issueCategoryLabels: Record<IssueCategory, string> = {
  does_not_power_on: "Naprava se ne vklopi",
  error_message: "Sporočilo o napaki na zaslonu",
  physical_damage: "Poškodba ohišja ali priključkov",
  battery_or_charging: "Težava z baterijo ali polnjenjem",
  accessory_fault: "Okvara dodatne opreme",
  scheduled_maintenance: "Redno vzdrževanje ali pregled",
  other: "Drugo",
};

export const urgencyLabels: Record<ServiceRequestUrgency, string> = {
  normal: "Običajna",
  high: "Visoka",
};

export const serviceRequestStatusLabels: Record<ServiceRequestStatus, string> = {
  new: "Novo",
  coordinating: "V usklajevanju",
  appointment_confirmed: "Termin potrjen",
  in_progress: "V izvedbi",
  closed: "Zaključeno",
};

export const serviceRequestStatusOrder: ServiceRequestStatus[] = [
  "new",
  "coordinating",
  "appointment_confirmed",
  "in_progress",
  "closed",
];

export const timelineActorLabels: Record<TimelineActor, string> = {
  organization: "Ustanova",
  service_partner: "Serviser",
  system: "Sistem",
};
