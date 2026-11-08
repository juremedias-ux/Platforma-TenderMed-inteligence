import type { Location, Organization, OrganizationService, StatedNeed } from "@/types/domain";

/**
 * Fictional organizations for the public demonstration.
 * Names are deliberately generic ("Vzorčni …", "Servis Sigma") so that they
 * cannot be mistaken for real Slovenian institutions or companies.
 */

export const DEMO_ORGANIZATION_ID = "org-demo";

export const demoOrganization: Organization = {
  id: DEMO_ORGANIZATION_ID,
  name: "Vzorčni zdravstveni zavod",
  kind: "healthcare_provider",
  country: "SI",
  isFictional: true,
};

export const demoPartners: Organization[] = [
  { id: "org-sigma", name: "Servis Sigma", kind: "service_provider", country: "SI", isFictional: true },
  { id: "org-tau", name: "Servis Tau", kind: "service_provider", country: "SI", isFictional: true },
  { id: "org-omega", name: "Distributer Omega", kind: "distributor", country: "SI", isFictional: true },
];

export const demoLocations: Location[] = [
  { id: "loc-er", organizationId: DEMO_ORGANIZATION_ID, name: "Urgentni center" },
  { id: "loc-int", organizationId: DEMO_ORGANIZATION_ID, name: "Interni oddelek, 2. nadstropje" },
  { id: "loc-amb", organizationId: DEMO_ORGANIZATION_ID, name: "Ambulanta družinske medicine" },
  { id: "loc-physio", organizationId: DEMO_ORGANIZATION_ID, name: "Fizioterapija" },
  { id: "loc-lab", organizationId: DEMO_ORGANIZATION_ID, name: "Laboratorij" },
  { id: "loc-ster", organizationId: DEMO_ORGANIZATION_ID, name: "Centralna sterilizacija" },
];

export const demoServices: OrganizationService[] = [
  {
    id: "svc-emergency",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Nujna medicinska pomoč",
    category: "emergency_care",
  },
  {
    id: "svc-inpatient",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Bolnišnična obravnava na internem oddelku",
    category: "inpatient_care",
  },
  {
    id: "svc-primary",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Ambulanta družinske medicine",
    category: "primary_care",
  },
  {
    id: "svc-physio",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Ambulantna fizioterapija",
    category: "physiotherapy_rehabilitation",
  },
  { id: "svc-lab", organizationId: DEMO_ORGANIZATION_ID, name: "Laboratorijska diagnostika", category: "laboratory" },
  {
    id: "svc-sterile",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Centralna sterilizacija",
    category: "sterilization",
  },
];

export const demoNeeds: StatedNeed[] = [
  {
    id: "need-transport",
    organizationId: DEMO_ORGANIZATION_ID,
    description: "Daljše delovanje monitorjev med premeščanjem med oddelki",
    relatedServiceId: "svc-inpatient",
    relatedEquipmentIds: ["eq-01", "eq-02"],
  },
  {
    id: "need-infusion",
    organizationId: DEMO_ORGANIZATION_ID,
    description: "Manj nenačrtovanih izpadov infuzijskih črpalk zaradi popravil",
    relatedServiceId: "svc-inpatient",
    relatedEquipmentIds: ["eq-03", "eq-04"],
  },
  {
    id: "need-physio",
    organizationId: DEMO_ORGANIZATION_ID,
    description: "Razširitev ponudbe ambulantne fizioterapije",
    relatedServiceId: "svc-physio",
  },
  {
    id: "need-overview",
    organizationId: DEMO_ORGANIZATION_ID,
    description: "Boljši pregled nad uporabo in razpoložljivostjo opreme med oddelki",
  },
];
