import {
  Ban,
  CalendarCheck,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  FileQuestion,
  MessagesSquare,
  Puzzle,
  SearchCheck,
  TriangleAlert,
  UserCheck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { equipmentStatusLabels, maintenanceStatusLabels } from "@/features/equipment/labels";
import { requirementStatusLabels, reviewLabelText, tenderLabelText } from "@/features/recommendations/labels";
import { serviceRequestStatusLabels } from "@/features/service/labels";
import type {
  EquipmentServiceStatus,
  MaintenanceStatus,
  RecommendationReviewLabel,
  RequirementMatchStatus,
  ServiceRequestStatus,
  TenderMatchLabel,
} from "@/types/domain";

/** Status badges always combine an icon with text; colour is never the only signal. */

type Spec = { tone: BadgeTone; icon: LucideIcon };

function StatusBadge({ spec, label, size }: { spec: Spec; label: string; size?: "sm" | "md" }) {
  const Icon = spec.icon;
  return (
    <Badge tone={spec.tone} size={size}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

const maintenanceSpecs: Record<MaintenanceStatus, Spec> = {
  overdue: { tone: "danger", icon: TriangleAlert },
  due_soon: { tone: "warning", icon: Clock },
  scheduled: { tone: "success", icon: CircleCheck },
  no_due_date: { tone: "neutral", icon: CircleDashed },
};

export function MaintenanceStatusBadge({ status, size }: { status: MaintenanceStatus; size?: "sm" | "md" }) {
  return <StatusBadge spec={maintenanceSpecs[status]} label={maintenanceStatusLabels[status]} size={size} />;
}

const equipmentSpecs: Record<EquipmentServiceStatus, Spec> = {
  overdue: maintenanceSpecs.overdue,
  due_soon: maintenanceSpecs.due_soon,
  ok: maintenanceSpecs.scheduled,
  not_scheduled: maintenanceSpecs.no_due_date,
};

export function EquipmentStatusBadge({ status, size }: { status: EquipmentServiceStatus; size?: "sm" | "md" }) {
  return <StatusBadge spec={equipmentSpecs[status]} label={equipmentStatusLabels[status]} size={size} />;
}

const requestSpecs: Record<ServiceRequestStatus, Spec> = {
  new: { tone: "info", icon: CircleDot },
  coordinating: { tone: "warning", icon: MessagesSquare },
  appointment_confirmed: { tone: "accent", icon: CalendarCheck },
  in_progress: { tone: "info", icon: Wrench },
  closed: { tone: "neutral", icon: CircleCheck },
};

export function ServiceRequestStatusBadge({ status, size }: { status: ServiceRequestStatus; size?: "sm" | "md" }) {
  return <StatusBadge spec={requestSpecs[status]} label={serviceRequestStatusLabels[status]} size={size} />;
}

const reviewSpecs: Record<RecommendationReviewLabel, Spec> = {
  worth_review: { tone: "accent", icon: SearchCheck },
  compatibility_check_needed: { tone: "warning", icon: Puzzle },
  insufficient_data: { tone: "neutral", icon: FileQuestion },
  not_compatible: { tone: "danger", icon: Ban },
};

export function ReviewLabelBadge({ label, size }: { label: RecommendationReviewLabel; size?: "sm" | "md" }) {
  return <StatusBadge spec={reviewSpecs[label]} label={reviewLabelText[label]} size={size} />;
}

const requirementSpecs: Record<RequirementMatchStatus, Spec> = {
  satisfied: { tone: "success", icon: Check },
  not_satisfied: { tone: "danger", icon: X },
  evidence_missing: { tone: "warning", icon: FileQuestion },
  human_review_required: { tone: "info", icon: UserCheck },
};

export function RequirementStatusBadge({ status }: { status: RequirementMatchStatus }) {
  return <StatusBadge spec={requirementSpecs[status]} label={requirementStatusLabels[status]} size="sm" />;
}

const tenderSpecs: Record<TenderMatchLabel, Spec> = {
  suitable_for_further_review: { tone: "accent", icon: SearchCheck },
  additional_review_required: { tone: "warning", icon: CircleAlert },
};

export function TenderLabelBadge({ label }: { label: TenderMatchLabel }) {
  return <StatusBadge spec={tenderSpecs[label]} label={tenderLabelText[label]} />;
}
