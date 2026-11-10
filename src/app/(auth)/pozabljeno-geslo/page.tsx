import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetRequestForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Pozabljeno geslo" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Pozabljeno geslo"
      description="Vpišite e-poštni naslov svojega računa. Če račun obstaja, vam pošljemo povezavo za ponastavitev gesla."
    >
      <PasswordResetRequestForm />
      <p className="mt-6 text-sm">
        <Link href="/prijava" className="font-medium text-accent-700 hover:text-accent-800">
          Nazaj na prijavo
        </Link>
      </p>
    </AuthCard>
  );
}
