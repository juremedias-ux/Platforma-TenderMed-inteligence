import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/password-forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ponastavitev gesla" };

async function ResetContent() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <AuthCard title="Ponastavitev gesla">
        <p role="alert" className="text-sm text-ink-soft">
          Povezava za ponastavitev gesla ni veljavna ali je potekla.{" "}
          <Link href="/pozabljeno-geslo" className="font-medium text-accent-700">
            Zahtevajte novo povezavo
          </Link>
          .
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Nastavite novo geslo" description={user.email ? `Račun: ${user.email}` : undefined}>
      <NewPasswordForm />
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCard title="Ponastavitev gesla">{null}</AuthCard>}>
      <ResetContent />
    </Suspense>
  );
}
