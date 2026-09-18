"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/cobrar", label: "Facturas", exact: true },
  { href: "/cobrar/clientes", label: "Clientes", exact: false },
  { href: "/cobrar/recordatorios", label: "Recordatorios", exact: false },
] as const;

export function GestionCobrosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-neutral-dark">Gestión de cobros</h1>
          <Link
            href="/cobrar/facturas-emitidas"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-neutral-dark transition-colors hover:border-brand-primary/50 hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <FileText className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            Ver facturas
          </Link>
        </div>
        <nav aria-label="Secciones de gestión de cobros" className="mt-5 border-b border-border">
          <div className="flex gap-8">
            {TABS.map((tab) => {
              const active = tab.exact
                ? pathname === tab.href || pathname.startsWith("/cobrar/facturas-emitidas")
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative pb-3 text-sm font-medium text-neutral-mid transition-colors hover:text-neutral-dark",
                    active && "text-brand-primary",
                  )}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
