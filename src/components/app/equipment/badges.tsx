import { AlertTriangle, Archive, CalendarCheck, CalendarClock, CheckCircle2, Wrench } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { describeDeadline, formatDate } from "@/lib/dates/format";
import { equipmentStatusLabels, type EquipmentStatus } from "@/lib/equipment/domain";
import { dueState, dueStateLabels, type DueState } from "@/lib/maintenance/schedule";

const dueTones: Record<DueState, BadgeTone> = {
  overdue: "danger",
  due_soon: "warning",
  scheduled: "neutral",
  done: "success",
  archived: "outline",
};

const dueIcons = {
  overdue: AlertTriangle,
  due_soon: CalendarClock,
  scheduled: CalendarCheck,
  done: CheckCircle2,
  archived: Archive,
};

/** Due state with text; colour is never the only signal. */
export function DueBadge({
  nextDue,
  today,
  archived = false,
}: {
  nextDue: string | null;
  today: string;
  archived?: boolean;
}) {
  const state = dueState(nextDue, today, archived);
  const Icon = dueIcons[state];
  return (
    <Badge tone={dueTones[state]} size="sm">
      <Icon aria-hidden="true" />
      {dueStateLabels[state]}
    </Badge>
  );
}

export function DueDate({ nextDue, today }: { nextDue: string | null; today: string }) {
  if (!nextDue) return <span className="text-ink-muted">Ni odprtega roka</span>;
  return (
    <span>
      <span className="font-medium text-ink">{formatDate(nextDue)}</span>
      <span className="block text-xs text-ink-muted">{describeDeadline(nextDue, today)}</span>
    </span>
  );
}

const statusTones: Record<EquipmentStatus, BadgeTone> = {
  active: "success",
  in_service: "info",
  temporarily_out: "warning",
  archived: "outline",
};

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return (
    <Badge tone={statusTones[status]} size="sm">
      {status === "in_service" ? <Wrench aria-hidden="true" /> : null}
      {status === "archived" ? <Archive aria-hidden="true" /> : null}
      {equipmentStatusLabels[status]}
    </Badge>
  );
}
