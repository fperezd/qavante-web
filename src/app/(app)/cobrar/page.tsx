import Link from "next/link";
import { ArrowDownToLine, FileText, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FeatureUnavailableState, QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CobrarView } from "@/components/cobrar/cobrar-view";
import { CobrarV2Live } from "@/components/cobrar/v2/cobrar-v2-live";

/* Cobrar (Sprint C4). Server Component: resuelve los flags. La IA usa LENGUAJE DE
   DUEÑO (pedido de Fernando 2026-07-28): arriba y a mano "Ver facturas" (lo que
   antes era el "Libro de Ventas (SII)", jerga de contador enterrada al fondo) y
   "Clientes"; debajo el hero de prioridad ("a quién le cobras primero"). Sin
   `export const runtime` (regla 4). */
export default function CobrarPage() {
  const { siiQueries, accountsReceivable, cobrarV2 } = resolveFeatureFlags();

  if (cobrarV2) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
            <p className="mt-1 text-sm text-neutral-mid">
              ¿Quién me debe y qué debo cobrar primero?
            </p>
          </div>
          {/* Accesos arriba, en lenguaje de dueño (antes "Libro de Ventas" al fondo). */}
          {siiQueries && (
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/cobrar/facturas-emitidas" icon={FileText} label="Ver facturas" />
              <QuickLink href="/cobrar/clientes" icon={Users} label="Clientes" />
            </div>
          )}
        </header>
        <CobrarV2Live siiEnabled={siiQueries} />
      </div>
    );
  }

  if (accountsReceivable) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
          <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
        </header>
        <CobrarView siiEnabled={siiQueries} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
          <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
        </div>
        {siiQueries && (
          <QuickLink href="/cobrar/facturas-emitidas" icon={FileText} label="Ver facturas" />
        )}
      </header>

      {!siiQueries && <FeatureUnavailableState />}

      <QavanteEmpty
        icon={ArrowDownToLine}
        title="Cobranza"
        description="Aquí vas a ver tus documentos por cobrar ordenados por prioridad, la cobranza vencida, la antigüedad de saldos y acciones sugeridas por cliente. Muy pronto disponible."
      />
    </div>
  );
}

/** Acceso secundario arriba (pill): "Ver facturas", "Clientes". */
function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-neutral-dark transition-colors hover:border-brand-primary/50 hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
      {label}
    </Link>
  );
}
