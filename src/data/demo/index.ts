import type { IsoDate } from "@/lib/dates/date-only";
import type {
  DocumentMetadata,
  Equipment,
  Location,
  MaintenancePlan,
  Manufacturer,
  Organization,
  OrganizationService,
  Product,
  RecommendationCandidate,
  ServiceEvent,
  ServiceRequest,
  StatedNeed,
  SupplierProfile,
  Tender,
} from "@/types/domain";
import { demoManufacturers, demoProductDocuments, demoProducts } from "./catalog";
import { buildEquipmentData } from "./equipment";
import { demoLocations, demoNeeds, demoOrganization, demoPartners, demoServices } from "./organization";
import { demoRecommendationCandidates } from "./recommendations";
import { buildDemoTenders, demoSupplierProfile } from "./tenders";

/** Complete fictional dataset for one reference date. Serializable. */
export interface DemoDataset {
  referenceDate: IsoDate;
  organization: Organization;
  partners: Organization[];
  locations: Location[];
  services: OrganizationService[];
  needs: StatedNeed[];
  manufacturers: Manufacturer[];
  products: Product[];
  documents: DocumentMetadata[];
  equipment: Equipment[];
  plans: MaintenancePlan[];
  serviceEvents: ServiceEvent[];
  serviceRequests: ServiceRequest[];
  recommendationCandidates: RecommendationCandidate[];
  tenders: Tender[];
  supplier: SupplierProfile;
}

export function createDemoDataset(referenceDate: IsoDate): DemoDataset {
  const { equipment, documents, plans, serviceEvents, serviceRequests } = buildEquipmentData(referenceDate);
  return {
    referenceDate,
    organization: demoOrganization,
    partners: demoPartners,
    locations: demoLocations,
    services: demoServices,
    needs: demoNeeds,
    manufacturers: demoManufacturers,
    products: demoProducts,
    documents: [...documents, ...demoProductDocuments],
    equipment,
    plans,
    serviceEvents,
    serviceRequests,
    recommendationCandidates: demoRecommendationCandidates,
    tenders: buildDemoTenders(referenceDate),
    supplier: demoSupplierProfile,
  };
}
