import type { Metadata } from "next";
import { BrandWordmark } from "@/components/layout/brand";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Layout for sign-in, password recovery and invitation pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <BrandWordmark />
        </div>
      </header>
      <main
        id="vsebina"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 py-12 focus:outline-none sm:py-20"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
