import type { Metadata } from "next";
import { Suspense } from "react";
import { MarkAllReadButton, PreferencesForm } from "@/components/app/notifications/notification-forms";
import { NotificationList } from "@/components/app/notifications/notification-list";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess } from "@/components/app/state-message";
import { requireOrgPage } from "@/lib/auth/session";
import { getEmailConfig } from "@/lib/config/server-env";
import { getPreferences, listNotifications } from "@/lib/repositories/notifications";

export const metadata: Metadata = { title: "Obvestila" };

type Props = PageProps<"/app/[organizationId]/obvestila">;

async function Notifications({ params }: Pick<Props, "params">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/obvestila`);
  if (!context) return <NoAccess />;
  let loaded;
  try {
    const [notifications, preferences] = await Promise.all([
      listNotifications(context.supabase, { organizationId }),
      getPreferences(context.supabase, context.user.id),
    ]);
    loaded = { notifications, preferences };
  } catch {
    return <LoadError />;
  }
  const unread = loaded.notifications.some((n) => !n.read_at);
  return (
    <>
      <PageHeader
        title="Obvestila"
        description="Opomniki o rokih in spremembe pri servisnih zahtevkih te organizacije."
        actions={unread ? <MarkAllReadButton organizationId={organizationId} /> : null}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6"
          aria-label="Seznam obvestil"
        >
          <NotificationList notifications={loaded.notifications} />
        </section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="prefs">
          <h2 id="prefs" className="text-base font-semibold text-ink">
            Nastavitve
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Veljajo za vse vaše organizacije. Obvestila v aplikaciji so vedno vključena.
          </p>
          <div className="mt-4">
            <PreferencesForm
              emailReminders={loaded.preferences.email_reminders}
              emailServiceUpdates={loaded.preferences.email_service_updates}
              emailConfigured={getEmailConfig() !== null}
            />
          </div>
        </section>
      </div>
    </>
  );
}

export default function NotificationsPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam obvestila …</p>}>
      <Notifications params={params} />
    </Suspense>
  );
}
