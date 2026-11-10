import { formatDate } from "@/lib/dates/format";
import { activityTypeLabels, isOneOf, activityTypes } from "@/lib/equipment/domain";

export function planLabel(plan: {
  activity_type: string;
  activity_label: string | null;
  next_due_date: string | null;
}) {
  const activity =
    plan.activity_label ??
    (isOneOf(activityTypes, plan.activity_type) ? activityTypeLabels[plan.activity_type] : plan.activity_type);
  return plan.next_due_date ? `${activity} (rok ${formatDate(plan.next_due_date)})` : activity;
}
