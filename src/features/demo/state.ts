import type { DemoDataset } from "@/data/demo";
import { applyCompletionToPlan } from "@/features/equipment/maintenance";
import { compareIsoDates, isValidIsoDate, type IsoDate } from "@/lib/dates/date-only";
import type {
  IssueCategory,
  MaintenancePlan,
  MatchExplanation,
  RecommendationReviewState,
  ServiceEvent,
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestUrgency,
  ServiceTimelineEvent,
} from "@/types/domain";

/**
 * In-memory state of the interactive demo.
 *
 * The state lives only in the browser tab (React state). It is never sent
 * to Supabase, browser storage, analytics or any external service, and it
 * is discarded on reload or with "Ponastavi demo".
 */
export interface DemoState {
  referenceDate: IsoDate;
  plans: MaintenancePlan[];
  serviceRequests: ServiceRequest[];
  serviceEvents: ServiceEvent[];
  recommendationStates: Record<string, RecommendationReviewState>;
  sequence: number;
}

export type DemoAction =
  | {
      type: "create_service_request";
      equipmentId: string;
      issueCategory: IssueCategory;
      urgency: ServiceRequestUrgency;
      proposedAppointment: IsoDate | null;
      replacementEquipmentRequested: boolean;
    }
  | { type: "propose_appointment"; requestId: string; date: IsoDate }
  | { type: "confirm_appointment"; requestId: string }
  | { type: "change_status"; requestId: string; status: ServiceRequestStatus }
  | {
      type: "record_completion";
      requestId: string;
      completionDate: IsoDate;
      planIds: string[];
      includesRepair: boolean;
    }
  | { type: "set_recommendation_state"; candidateId: string; state: RecommendationReviewState }
  | { type: "reset"; initialState: DemoState };

export function createInitialDemoState(dataset: DemoDataset, recommendations: MatchExplanation[]): DemoState {
  return {
    referenceDate: dataset.referenceDate,
    plans: dataset.plans,
    serviceRequests: dataset.serviceRequests,
    serviceEvents: dataset.serviceEvents,
    recommendationStates: Object.fromEntries(recommendations.map((r) => [r.candidateId, "new" as const])),
    sequence: 100,
  };
}

/** Why a status cannot be selected for a request, or null when it can. */
export function statusChangeBlocker(request: ServiceRequest, status: ServiceRequestStatus): string | null {
  if ((status === "appointment_confirmed" || status === "in_progress") && !request.confirmedAppointment) {
    return "Najprej potrdite termin.";
  }
  return null;
}

/** Why completion cannot be recorded for a request, or null when it can. */
export function completionBlocker(
  request: ServiceRequest,
  completionDate: string,
  planIds: string[],
  includesRepair: boolean,
  referenceDate: IsoDate,
): string | null {
  if (request.completionEventId) return "Izvedba je za ta zahtevek že zabeležena.";
  if (!isValidIsoDate(completionDate)) return "Vnesite veljaven datum izvedbe.";
  if (compareIsoDates(completionDate, referenceDate) > 0) return "Datum izvedbe ne sme biti v prihodnosti.";
  if (compareIsoDates(completionDate, request.createdOn) < 0) {
    return "Datum izvedbe ne sme biti pred datumom prijave.";
  }
  if (planIds.length === 0 && !includesRepair) return "Izberite vsaj eno izvedeno aktivnost.";
  return null;
}

function updateRequest(
  state: DemoState,
  requestId: string,
  update: (request: ServiceRequest, nextId: () => string) => ServiceRequest | null,
): DemoState {
  let sequence = state.sequence;
  const nextId = () => `demo-${++sequence}`;
  let changed = false;
  const serviceRequests = state.serviceRequests.map((request) => {
    if (request.id !== requestId) return request;
    const updated = update(request, nextId);
    if (!updated) return request;
    changed = true;
    return updated;
  });
  return changed ? { ...state, serviceRequests, sequence } : state;
}

function timelineEvent(
  id: string,
  date: IsoDate,
  kind: ServiceTimelineEvent["kind"],
  extra: Partial<ServiceTimelineEvent> = {},
): ServiceTimelineEvent {
  return { id, date, actor: "organization", kind, ...extra };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const today = state.referenceDate;

  switch (action.type) {
    case "create_service_request": {
      if (action.proposedAppointment && compareIsoDates(action.proposedAppointment, today) < 0) return state;
      let sequence = state.sequence;
      const id = `sr-demo-${++sequence}`;
      const timeline: ServiceTimelineEvent[] = [timelineEvent(`${id}-t${++sequence}`, today, "created")];
      if (action.proposedAppointment) {
        timeline.push(
          timelineEvent(`${id}-t${++sequence}`, today, "appointment_proposed", {
            appointment: action.proposedAppointment,
          }),
        );
      }
      const request: ServiceRequest = {
        id,
        organizationId: state.plans[0]?.organizationId ?? "org-demo",
        equipmentId: action.equipmentId,
        requestingOrganizationId: state.plans[0]?.organizationId ?? "org-demo",
        issueCategory: action.issueCategory,
        urgency: action.urgency,
        status: "new",
        createdOn: today,
        proposedAppointment: action.proposedAppointment,
        confirmedAppointment: null,
        replacementEquipmentRequested: action.replacementEquipmentRequested,
        timeline,
        completionEventId: null,
      };
      return { ...state, serviceRequests: [request, ...state.serviceRequests], sequence };
    }

    case "propose_appointment":
      return updateRequest(state, action.requestId, (request, nextId) => {
        if (request.status === "closed" || compareIsoDates(action.date, today) < 0) return null;
        const timeline = [
          ...request.timeline,
          timelineEvent(nextId(), today, "appointment_proposed", { appointment: action.date }),
        ];
        // A new proposal replaces any earlier confirmation: the date must be confirmed again.
        const status: ServiceRequestStatus =
          request.status === "new" || request.status === "appointment_confirmed" ? "coordinating" : request.status;
        if (status !== request.status) {
          timeline.push(timelineEvent(nextId(), today, "status_changed", { actor: "system", status }));
        }
        return { ...request, proposedAppointment: action.date, confirmedAppointment: null, status, timeline };
      });

    case "confirm_appointment":
      return updateRequest(state, action.requestId, (request, nextId) => {
        if (!request.proposedAppointment || request.status === "closed") return null;
        if (request.confirmedAppointment === request.proposedAppointment) return null;
        const timeline = [
          ...request.timeline,
          timelineEvent(nextId(), today, "appointment_confirmed", { appointment: request.proposedAppointment }),
        ];
        const status: ServiceRequestStatus = request.status === "in_progress" ? "in_progress" : "appointment_confirmed";
        if (status !== request.status) {
          timeline.push(timelineEvent(nextId(), today, "status_changed", { actor: "system", status }));
        }
        return { ...request, confirmedAppointment: request.proposedAppointment, status, timeline };
      });

    case "change_status":
      return updateRequest(state, action.requestId, (request, nextId) => {
        if (request.status === action.status || statusChangeBlocker(request, action.status)) return null;
        return {
          ...request,
          status: action.status,
          timeline: [...request.timeline, timelineEvent(nextId(), today, "status_changed", { status: action.status })],
        };
      });

    case "record_completion": {
      const request = state.serviceRequests.find((r) => r.id === action.requestId);
      if (!request) return state;
      const devicePlanIds = new Set(state.plans.filter((p) => p.equipmentId === request.equipmentId).map((p) => p.id));
      const planIds = action.planIds.filter((id) => devicePlanIds.has(id));
      if (completionBlocker(request, action.completionDate, planIds, action.includesRepair, today)) return state;

      let sequence = state.sequence;
      const eventId = `se-demo-${++sequence}`;
      const performedPlans = state.plans.filter((p) => planIds.includes(p.id));
      const event: ServiceEvent = {
        id: eventId,
        organizationId: request.organizationId,
        equipmentId: request.equipmentId,
        date: action.completionDate,
        types: [...performedPlans.map((p) => p.activityType), ...(action.includesRepair ? (["repair"] as const) : [])],
        servicePartnerId: request.servicePartnerId,
        costEur: null,
        summary: "Izvedba zabeležena v demonstraciji.",
        serviceRequestId: request.id,
        documentIds: [],
        createdInDemoSession: true,
      };
      const timelineId = `${request.id}-t${++sequence}`;

      return {
        ...state,
        sequence,
        serviceEvents: [event, ...state.serviceEvents],
        plans: state.plans.map((plan) =>
          planIds.includes(plan.id) ? applyCompletionToPlan(plan, action.completionDate) : plan,
        ),
        serviceRequests: state.serviceRequests.map((r) =>
          r.id === request.id
            ? {
                ...r,
                completionEventId: eventId,
                timeline: [...r.timeline, timelineEvent(timelineId, today, "completion_recorded")],
              }
            : r,
        ),
      };
    }

    case "set_recommendation_state":
      if (!(action.candidateId in state.recommendationStates)) return state;
      return {
        ...state,
        recommendationStates: { ...state.recommendationStates, [action.candidateId]: action.state },
      };

    case "reset":
      return action.initialState;
  }
}
