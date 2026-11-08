/**
 * Domain models for TenderMed Intelligence.
 *
 * These types describe equipment management, service coordination,
 * product information and procurement matching. They intentionally contain
 * no patient, diagnosis, measurement or treatment data.
 *
 * Organization-scoped records carry an `organizationId` so that a future
 * multi-organization application can scope queries. The field alone does
 * NOT provide tenant isolation: production isolation requires authenticated
 * access control (e.g. row-level security policies bound to verified
 * organization membership), which is outside this release.
 */

import type { IsoDate } from "@/lib/dates/date-only";

export type { IsoDate };

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export type OrganizationKind = "healthcare_provider" | "distributor" | "service_provider" | "manufacturer";

export interface Organization {
  id: string;
  name: string;
  kind: OrganizationKind;
  country: "SI";
  /** Every organization in the public demo is fictional. */
  isFictional: boolean;
}

export type ServiceCategory =
  | "emergency_care"
  | "inpatient_care"
  | "primary_care"
  | "physiotherapy_rehabilitation"
  | "laboratory"
  | "sterilization";

/** A service the healthcare organization provides (e.g. physiotherapy). */
export interface OrganizationService {
  id: string;
  organizationId: string;
  name: string;
  category: ServiceCategory;
}

/** An operational need stated explicitly by the organization. */
export interface StatedNeed {
  id: string;
  organizationId: string;
  description: string;
  relatedServiceId?: string;
  relatedEquipmentIds?: string[];
}

export interface Location {
  id: string;
  organizationId: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Equipment and maintenance
// ---------------------------------------------------------------------------

export type EquipmentCategory =
  | "patient_monitoring"
  | "infusion"
  | "defibrillation"
  | "ultrasound_imaging"
  | "sterilization"
  | "physiotherapy"
  | "laboratory"
  | "ecg"
  | "suction";

export interface Equipment {
  id: string;
  organizationId: string;
  name: string;
  category: EquipmentCategory;
  manufacturerId: string;
  /** Optional link to a product record; the product need not belong to any operator catalog. */
  productId?: string;
  model: string;
  serialNumber: string;
  locationId: string;
  purchaseDate: IsoDate;
  warrantyEndDate: IsoDate;
  /** Expected service life as stated in manufacturer documentation, if recorded. */
  expectedServiceLifeYears?: number;
  /** Indicative replacement value recorded by the organization, if known. */
  replacementValueEur?: number;
  servicePartnerId?: string;
  documentIds: string[];
}

/** Inspection, calibration and preventive maintenance are tracked separately; warranty is an equipment attribute. */
export type MaintenanceActivityType = "preventive_maintenance" | "inspection" | "calibration";

export type ScheduleBasis = "manufacturer_instructions" | "organization_procedure" | "service_contract";

export interface ScheduleSource {
  basis: ScheduleBasis;
  /** Document that defines the requirement, when recorded. */
  documentId?: string;
}

/** Recurring requirement calculated from the last recorded completion. */
export interface IntervalSchedule {
  kind: "interval";
  intervalMonths: number;
  lastCompletedDate: IsoDate;
}

/** Due date entered manually (e.g. agreed in a service contract). */
export interface ManualSchedule {
  kind: "manual";
  dueDate: IsoDate | null;
  lastCompletedDate: IsoDate | null;
}

export interface MaintenancePlan {
  id: string;
  organizationId: string;
  equipmentId: string;
  activityType: MaintenanceActivityType;
  schedule: IntervalSchedule | ManualSchedule;
  source: ScheduleSource;
  /** Role responsible for organizing the activity. */
  responsibleRole: string;
  servicePartnerId?: string;
}

export type MaintenanceStatus = "overdue" | "due_soon" | "scheduled" | "no_due_date";

/** Aggregated service status of a device. */
export type EquipmentServiceStatus = "overdue" | "due_soon" | "ok" | "not_scheduled";

// ---------------------------------------------------------------------------
// Service coordination
// ---------------------------------------------------------------------------

export type IssueCategory =
  | "does_not_power_on"
  | "error_message"
  | "physical_damage"
  | "battery_or_charging"
  | "accessory_fault"
  | "scheduled_maintenance"
  | "other";

export type ServiceRequestUrgency = "normal" | "high";

export type ServiceRequestStatus = "new" | "coordinating" | "appointment_confirmed" | "in_progress" | "closed";

export type TimelineActor = "organization" | "service_partner" | "system";

export type TimelineEventKind =
  "created" | "status_changed" | "appointment_proposed" | "appointment_confirmed" | "completion_recorded" | "note";

export interface ServiceTimelineEvent {
  id: string;
  date: IsoDate;
  actor: TimelineActor;
  kind: TimelineEventKind;
  status?: ServiceRequestStatus;
  appointment?: IsoDate;
  /** Fictional coordination note (Slovenian demo copy). */
  note?: string;
}

export interface ServiceRequest {
  id: string;
  organizationId: string;
  equipmentId: string;
  requestingOrganizationId: string;
  servicePartnerId?: string;
  issueCategory: IssueCategory;
  urgency: ServiceRequestUrgency;
  status: ServiceRequestStatus;
  createdOn: IsoDate;
  proposedAppointment: IsoDate | null;
  confirmedAppointment: IsoDate | null;
  replacementEquipmentRequested: boolean;
  timeline: ServiceTimelineEvent[];
  /** Completion evidence is recorded separately from the request status. */
  completionEventId: string | null;
}

export type ServiceEventType = MaintenanceActivityType | "repair";

/** A recorded service activity (service history entry). */
export interface ServiceEvent {
  id: string;
  organizationId: string;
  equipmentId: string;
  date: IsoDate;
  types: ServiceEventType[];
  servicePartnerId?: string;
  costEur: number | null;
  summary: string;
  serviceRequestId?: string;
  documentIds: string[];
  /** True when the record was created by a visitor during the demo session. */
  createdInDemoSession?: boolean;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocumentType =
  | "instructions_for_use"
  | "instructions_for_use_sl"
  | "service_report"
  | "calibration_report"
  | "warranty_certificate"
  | "acceptance_record"
  | "compatibility_list"
  | "declaration_of_conformity"
  | "technical_datasheet"
  | "service_contract"
  | "service_references";

export type DocumentOrigin = "manufacturer" | "service_partner" | "organization" | "supplier";

/** Document metadata only — no file is stored in this release. */
export interface DocumentMetadata {
  id: string;
  organizationId?: string;
  equipmentId?: string;
  productId?: string;
  type: DocumentType;
  title: string;
  issuedOn?: IsoDate;
  origin: DocumentOrigin;
  fileStored: false;
}

// ---------------------------------------------------------------------------
// Manufacturers and products
// ---------------------------------------------------------------------------

export interface Manufacturer {
  id: string;
  name: string;
  isFictional: boolean;
}

export type ProductType = "device" | "accessory" | "software" | "consumable";

/** How far the platform has checked the product information. */
export type ProductVerificationStatus = "unverified" | "documentation_received" | "documentation_reviewed";

export type CommercialRelationship =
  "none_declared" | "platform_operator_distributes" | "partner_listing" | "sponsored";

export interface DocumentReference {
  documentId: string;
}

export interface IntendedUseStatement {
  /** Short paraphrase for display; the source document is authoritative. */
  summary: string;
  source: DocumentReference;
}

export interface CompatibilityDeclaration {
  /** Model designation of the equipment or consumable this declaration concerns. */
  targetModel: string;
  status: "confirmed" | "incompatible";
  source: DocumentReference;
}

export interface MarketAvailability {
  slovenia: "available" | "not_available" | "unknown";
  localDistributorId?: string;
  localServiceAvailable?: boolean;
}

export interface Product {
  id: string;
  manufacturerId: string;
  name: string;
  model: string;
  category: EquipmentCategory | "equipment_management_software";
  productType: ProductType;
  intendedUse: IntendedUseStatement | null;
  compatibility: CompatibilityDeclaration[];
  documentIds: string[];
  verificationStatus: ProductVerificationStatus;
  marketAvailability: MarketAvailability;
  /** Service categories the manufacturer documentation associates with the product. */
  supportedServiceCategories: ServiceCategory[];
  commercialRelationship: CommercialRelationship;
  isFictional: boolean;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type RecommendationKind =
  "complementary_accessory" | "replacement_candidate" | "service_expansion" | "emerging_solution";

/** A candidate pairing of a product with an organization's context, before evaluation. */
export interface RecommendationCandidate {
  id: string;
  organizationId: string;
  productId: string;
  kind: RecommendationKind;
  relatedEquipmentIds: string[];
  relatedNeedIds: string[];
  relatedServiceIds: string[];
  /** Models that must be compatible with the product (equipment or consumables in use). */
  compatibilityTargets: { model: string; label: string }[];
}

export type RecommendationReviewLabel =
  "worth_review" | "compatibility_check_needed" | "insufficient_data" | "not_compatible";

export type CompatibilityStatus = "confirmed" | "incompatible" | "unknown" | "not_applicable";

export interface EvidenceItem {
  label: string;
  documentId?: string;
}

export interface CompatibilityAssessment {
  status: CompatibilityStatus;
  details: { target: string; status: Exclude<CompatibilityStatus, "not_applicable">; documentId?: string }[];
}

export interface ReplacementConsideration {
  applies: boolean;
  reasons: string[];
  /** Fixed caveat: age or cost alone does not indicate that equipment is unsafe. */
  caveat: string;
}

/** Explainable output of the matching engine for one recommendation. */
export interface MatchExplanation {
  candidateId: string;
  productId: string;
  reviewLabel: RecommendationReviewLabel;
  relevance: { established: boolean; reasons: string[] };
  compatibility: CompatibilityAssessment;
  evidence: EvidenceItem[];
  missingInformation: string[];
  replacement: ReplacementConsideration | null;
  commercialRelationship: CommercialRelationship;
  suggestedNextStep: string;
  engine: { kind: "deterministic_rules" | "external_model"; version: string };
}

export type RecommendationReviewState = "new" | "saved" | "dismissed";

// ---------------------------------------------------------------------------
// Tenders
// ---------------------------------------------------------------------------

export type SupplierCapability =
  | "user_training"
  | "rental_with_purchase_option"
  | "replacement_equipment_during_service"
  | "manufacturer_authorized_service";

export type SupplierAttribute = "warrantyMonths" | "serviceResponseHours" | "deliveryDays";

export type TenderRequirementRule =
  | { kind: "document"; documentType: DocumentType }
  | { kind: "capability"; capability: SupplierCapability }
  | { kind: "min_value"; attribute: SupplierAttribute; min: number }
  | { kind: "max_value"; attribute: SupplierAttribute; max: number }
  | { kind: "manual_review"; reason: string };

export interface TenderRequirement {
  id: string;
  description: string;
  rule: TenderRequirementRule;
}

export interface Tender {
  id: string;
  /** Always true in this release: no live procurement source is connected. */
  isIllustrative: true;
  title: string;
  buyerName: string;
  equipmentCategory: EquipmentCategory;
  publishedOn: IsoDate;
  deadline: IsoDate;
  requirements: TenderRequirement[];
  /** No URLs to real notices are stored for illustrative tenders. */
  sourceUrl: null;
}

/** Profile of the supplier from whose perspective tenders are evaluated. */
export interface SupplierProfile {
  id: string;
  name: string;
  capabilities: Partial<Record<SupplierCapability, boolean>>;
  attributes: Partial<Record<SupplierAttribute, number>>;
  documentTypes: DocumentType[];
}

export type RequirementMatchStatus = "satisfied" | "not_satisfied" | "evidence_missing" | "human_review_required";

export interface RequirementMatchResult {
  requirementId: string;
  status: RequirementMatchStatus;
  explanation: string;
}

export type TenderMatchLabel = "suitable_for_further_review" | "additional_review_required";

export interface TenderMatchResult {
  tenderId: string;
  label: TenderMatchLabel;
  requirements: RequirementMatchResult[];
  missingEvidence: string[];
  summary: string;
  engine: { kind: "deterministic_rules" | "external_model"; version: string };
}
