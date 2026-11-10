import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { AcceptInvitationForm, CreateAccountForm } from "@/components/auth/invitation-forms";
import { logoutAction } from "@/app/(auth)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { orgRoleLabels, isOrgRole } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { byteaHex, hashInvitationToken, isWellFormedToken } from "@/lib/auth/tokens";
import { formatDateTime } from "@/lib/dates/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const metadata: Metadata = { title: "Povabilo" };

interface Preview {
  organization_name: string;
  kind: "membership" | "service_assignment";
  role: string | null;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
}

const statusMessages: Record<Exclude<Preview["status"], "pending">, string> = {
  accepted: "To povabilo je že bilo uporabljeno. Če ste ga sprejeli vi, se prijavite.",
  revoked: "Povabilo je bilo preklicano. Za dostop prosite pošiljatelja za novo povabilo.",
  expired: "Povabilo je poteklo. Za dostop prosite pošiljatelja za novo povabilo.",
};

async function InvitationContent({ params }: { params: PageProps<"/povabilo/[token]">["params"] }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <AuthCard title="Povabilo">Platforma še ni konfigurirana.</AuthCard>;
  }

  const invalid = (
    <AuthCard title="Povabilo ni veljavno">
      <p className="text-sm text-ink-soft">
        Povezava povabila ni veljavna. Preverite, ali ste kopirali celotno povezavo.
      </p>
    </AuthCard>
  );
  if (!isWellFormedToken(token)) return invalid;

  const { data, error } = await supabase.rpc("get_invitation_preview", {
    p_token_hash: byteaHex(hashInvitationToken(token)),
  });
  const preview = (data as Preview[] | null)?.[0];
  if (error || !preview) return invalid;

  const what =
    preview.kind === "membership"
      ? `članstvo v organizaciji ${preview.organization_name} (vloga: ${preview.role && isOrgRole(preview.role) ? orgRoleLabels[preview.role] : "—"})`
      : `dostop do servisnega zahtevka organizacije ${preview.organization_name}`;

  if (preview.status !== "pending") {
    return (
      <AuthCard title="Povabilo ni več veljavno">
        <p className="text-sm text-ink-soft">{statusMessages[preview.status]}</p>
        <Link href="/prijava" className={`${buttonVariants({ variant: "secondary" })} mt-6`}>
          Na prijavo
        </Link>
      </AuthCard>
    );
  }

  const user = await getSessionUser();
  const description = (
    <>
      Povabljeni ste v platformo TenderMed Intelligence: {what}. Povabilo velja do {formatDateTime(preview.expires_at)}.
    </>
  );

  if (user) {
    if (user.email !== preview.email) {
      return (
        <AuthCard title="Povabilo za drug naslov" description={description}>
          <p role="alert" className="text-sm text-ink-soft">
            Prijavljeni ste kot <strong>{user.email}</strong>, povabilo pa je namenjeno naslovu{" "}
            <strong>{preview.email}</strong>. Odjavite se in se prijavite z ustreznim računom.
          </p>
          <form action={logoutAction} className="mt-6">
            <Button type="submit" variant="secondary">
              Odjava
            </Button>
          </form>
        </AuthCard>
      );
    }
    return (
      <AuthCard title="Sprejmite povabilo" description={description}>
        <AcceptInvitationForm token={token} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Ustvarite račun" description={description}>
      <CreateAccountForm token={token} email={preview.email} />
      <p className="mt-6 border-t border-line pt-5 text-sm text-ink-soft">
        Že imate račun s tem naslovom?{" "}
        <Link
          href={`/prijava?next=${encodeURIComponent(`/povabilo/${token}`)}`}
          className="font-medium text-accent-700 hover:text-accent-800"
        >
          Prijavite se
        </Link>{" "}
        in nato sprejmite povabilo.
      </p>
    </AuthCard>
  );
}

export default function InvitationPage({ params }: PageProps<"/povabilo/[token]">) {
  return (
    <Suspense fallback={<AuthCard title="Povabilo">{null}</AuthCard>}>
      <InvitationContent params={params} />
    </Suspense>
  );
}
