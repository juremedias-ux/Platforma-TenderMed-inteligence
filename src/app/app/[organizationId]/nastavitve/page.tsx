import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import {
  InvitationForm,
  MemberRoleForm,
  OrganizationForm,
  RemoveMemberButton,
  RevokeInvitationButton,
} from "@/components/app/settings/settings-forms";
import { CreateLocationForm, LocationRow } from "@/components/app/equipment/location-forms";
import { LoadError, NoAccess } from "@/components/app/state-message";
import {
  assignableRoles,
  can,
  invitableRoles,
  isOrgRole,
  orgRoleDescriptions,
  orgRoleLabels,
} from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates/datetime";

export const metadata: Metadata = { title: "Nastavitve" };

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

async function Settings({ params }: { params: PageProps<"/app/[organizationId]/nastavitve">["params"] }) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/nastavitve`);
  if (!context) return <NoAccess />;
  const { supabase, role, organization, user } = context;

  const [members, invitations, locations] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("user_id, role, created_at, profiles!organization_memberships_user_id_fkey(full_name, email)")
      .eq("organization_id", organizationId)
      .order("created_at"),
    can(role, "invitations.manage")
      ? supabase
          .from("invitations")
          .select("id, email, role, expires_at, created_at")
          .eq("organization_id", organizationId)
          .eq("kind", "membership")
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("locations")
      .select("id, name, version, archived_at")
      .eq("organization_id", organizationId)
      .order("archived_at", { ascending: true, nullsFirst: true })
      .order("name"),
  ]);
  if (members.error || invitations.error || locations.error) return <LoadError />;

  return (
    <>
      <PageHeader title="Nastavitve" description="Organizacija, člani, povabila in lokacije." />
      <div className="space-y-6">
        <Card title="Organizacija">
          {can(role, "org.settings") ? (
            <OrganizationForm
              organizationId={organizationId}
              name={organization.name}
              requireAcknowledgment={organization.requireCompletionAcknowledgment}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Ime</dt>
                <dd className="font-medium text-ink">{organization.name}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Potrditev izvedbe zunanjih serviserjev</dt>
                <dd className="font-medium text-ink">
                  {organization.requireCompletionAcknowledgment ? "Zahtevana" : "Ni zahtevana"}
                </dd>
              </div>
            </dl>
          )}
        </Card>

        <Card
          title="Člani"
          description="Vloge določajo dostop. Svoje vloge ne morete spremeniti sami; organizacija mora imeti vsaj enega lastnika."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Člani organizacije</caption>
              <thead className="border-b border-line text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Član
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Vloga
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Dejanja</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(members.data ?? []).map((member) => {
                  const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                  const memberRole = isOrgRole(member.role) ? member.role : "viewer";
                  const name = profile?.full_name || profile?.email || "Član";
                  const self = member.user_id === user.id;
                  const options = self ? [] : assignableRoles(role, memberRole);
                  return (
                    <tr key={member.user_id}>
                      <th scope="row" className="py-3 pr-4 align-top font-normal">
                        <span className="block font-medium text-ink">
                          {name}
                          {self ? " (vi)" : ""}
                        </span>
                        <span className="block text-xs text-ink-muted">{profile?.email}</span>
                      </th>
                      <td className="py-3 pr-4 align-top">
                        {options.length > 1 ? (
                          <MemberRoleForm
                            organizationId={organizationId}
                            userId={member.user_id}
                            current={memberRole}
                            options={options}
                          />
                        ) : (
                          <span title={orgRoleDescriptions[memberRole]}>{orgRoleLabels[memberRole]}</span>
                        )}
                      </td>
                      <td className="py-3 text-right align-top">
                        {!self && options.length > 0 ? (
                          <RemoveMemberButton organizationId={organizationId} userId={member.user_id} name={name} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Lokacije"
          description="Oddelki ali prostori, kjer je oprema. Arhivirane lokacije ostanejo pri obstoječi opremi."
        >
          {can(role, "equipment.manage") ? (
            <div className="space-y-2">
              <CreateLocationForm organizationId={organizationId} />
              {(locations.data ?? []).length > 0 ? (
                <div className="divide-y divide-line border-t border-line">
                  {(locations.data ?? []).map((location) => (
                    <LocationRow key={location.id} organizationId={organizationId} location={location} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (locations.data ?? []).length > 0 ? (
            <ul className="space-y-1 text-sm">
              {(locations.data ?? []).map((location) => (
                <li key={location.id}>
                  {location.name}
                  {location.archived_at ? <span className="text-ink-muted"> (arhivirana)</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Ni vpisanih lokacij.</p>
          )}
        </Card>

        {can(role, "invitations.manage") ? (
          <Card
            title="Povabila"
            description="Platforma je dostopna samo s povabilom. E-poštno pošiljanje povabil še ni konfigurirano, zato povezavo pošljete sami."
          >
            <InvitationForm organizationId={organizationId} roles={invitableRoles(role)} />
            <h3 className="mt-6 text-sm font-semibold text-ink">Aktivna povabila</h3>
            {invitations.data && invitations.data.length > 0 ? (
              <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                {invitations.data.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span>
                      <span className="block font-medium text-ink">{invitation.email}</span>
                      <span className="block text-xs text-ink-muted">
                        {isOrgRole(invitation.role) ? orgRoleLabels[invitation.role] : invitation.role} · velja do{" "}
                        {formatDateTime(invitation.expires_at)}
                      </span>
                    </span>
                    <RevokeInvitationButton
                      organizationId={organizationId}
                      invitationId={invitation.id}
                      email={invitation.email}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Ni aktivnih povabil.</p>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}

export default function SettingsPage({ params }: PageProps<"/app/[organizationId]/nastavitve">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam nastavitve …</p>}>
      <Settings params={params} />
    </Suspense>
  );
}
