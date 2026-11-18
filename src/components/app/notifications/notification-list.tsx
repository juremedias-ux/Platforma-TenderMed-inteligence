import { Bell, CalendarClock, UserPlus, Wrench } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates/datetime";
import type { NotificationRow } from "@/lib/repositories/notifications";
import { cn } from "@/lib/utils/cn";
import { MarkReadButton } from "./notification-forms";

const icons = {
  due_reminder: CalendarClock,
  overdue_reminder: CalendarClock,
  service_update: Wrench,
  assignment: UserPlus,
};

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  if (notifications.length === 0) return <p className="text-sm text-ink-muted">Ni obvestil.</p>;
  return (
    <ul className="divide-y divide-line">
      {notifications.map((n) => {
        const Icon = icons[n.kind] ?? Bell;
        return (
          <li key={n.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 gap-3">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  n.kind === "overdue_reminder" ? "text-danger-700" : "text-ink-muted",
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 text-sm">
                <Link
                  href={n.link_path}
                  className={cn("text-ink underline-offset-2 hover:underline", !n.read_at && "font-semibold")}
                >
                  {n.title}
                </Link>
                {n.body ? <p className="text-ink-soft">{n.body}</p> : null}
                <p className="text-xs text-ink-muted">
                  {formatDateTime(n.created_at)}
                  {n.read_at ? "" : " · neprebrano"}
                </p>
              </div>
            </div>
            {!n.read_at ? <MarkReadButton id={n.id} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
