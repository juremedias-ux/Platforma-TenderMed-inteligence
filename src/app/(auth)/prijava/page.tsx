import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser, isPlatformConfigured } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Prijava" };

const errorMessages: Record<string, string> = {
  povezava: "Povezava ni veljavna ali je potekla. Prijavite se ali zahtevajte novo povezavo.",
  seja: "Vaša seja je potekla. Prijavite se znova.",
};

async function LoginContent({ searchParams }: { searchParams: PageProps<"/prijava">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getSessionUser()) redirect(next);
  const configured = await isPlatformConfigured();
  const error = typeof params.napaka === "string" ? errorMessages[params.napaka] : undefined;

  return (
    <AuthCard
      title="Prijava v platformo"
      description="Platforma je v pilotni fazi in dostopna le povabljenim uporabnikom."
    >
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-md border border-warning-200 bg-warning-50 px-3.5 py-3 text-sm text-warning-700"
        >
          {error}
        </p>
      ) : null}
      {configured ? (
        <LoginForm next={next} />
      ) : (
        <p role="status" className="rounded-md border border-line bg-subtle px-3.5 py-3 text-sm text-ink-soft">
          Prijava trenutno ni na voljo, ker platforma še ni konfigurirana.
        </p>
      )}
    </AuthCard>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/prijava">) {
  return (
    <Suspense fallback={<AuthCard title="Prijava v platformo">{null}</AuthCard>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
