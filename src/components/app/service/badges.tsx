import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requestStatusLabels, requestStatusTones, type Priority, type RequestStatus } from "@/lib/service/domain";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge tone={requestStatusTones[status]} size="sm">
      {requestStatusLabels[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority !== "urgent") return null;
  return (
    <Badge tone="danger" size="sm">
      <AlertTriangle aria-hidden="true" />
      Nujno
    </Badge>
  );
}
