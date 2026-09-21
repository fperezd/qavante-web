import type { ReactNode } from "react";
import Link from "next/link";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-neutral-dark">
      <header className="border-b border-neutral-light/70 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <p className="text-sm font-semibold tracking-tight">
            <span className="text-brand-primary">Qavante</span>
            <span className="text-neutral-mid"> · Documentos legales</span>
          </p>
          <Link href="/banco" className="text-sm text-neutral-mid hover:text-neutral-dark">
            Volver
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
