import Link from "next/link";
import { ArrowDownToLine, FileText, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FeatureUnavailableState, QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CobrarView } from "@/components/cobrar/cobrar-view";
import { CobrarV2Live } from "@/components/cobrar/v2/cobrar-v2-live";
import { CobrarV04Live } from "@/components/cobrar/v04/cobrar-v04-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";

/* Cobrar (Sprint C4). Server Component: resuelve los flags. La IA usa LENGUAJE DE
   DUEÑO (pedido de Fernando 2026-07-28): arriba y a mano "Ver facturas" (lo que
   antes era el "Libro de Ventas (SII)", jerga de contador enterrada al fondo) y
   "Clientes"; debajo el hero de prioridad ("a quién le cobras primero"). Sin
   `export const runtime` (regla 4). */
export default function CobrarPage() {
  const { siiQueries, accountsReceivable, cobrarV2, cobrarV04, decisionBrief } =
    resolveFeatureFlags();

  /* V04 · Cobrar (rediseño Fase 2, issue #69) — gated por `cobrarV04`, HOY ENCENDIDO en producción (`wrangler.toml`). Reemplaza la
     landing entera por la vista de la spec (una pantalla, una pregunta: "¿quién me debe?"). Con
     OFF nada de abajo cambia (cero regresión: producción sigue sirviendo v2). Se conservan los
     accesos "Ver facturas" y "Clientes": son las rutas de detalle a las que la tabla no llega sola. */
  if (cobrarV04) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
          </div>
          {siiQueries && (
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/cobrar/facturas-emitidas" icon={FileText} label="Ver facturas" />
              <QuickLink href="/cobrar/clientes" icon={Users} label="Clientes" />
            </div>
          )}
        </header>
        {decisionBrief && <DecisionBriefSlot surface="cobrar" />}
        <CobrarV04Live suppressRecommendations={decisionBrief} />
      </div>
    );
  }

  if (cobrarV2) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
          </div>
          {/* Accesos arriba, en lenguaje de dueño (antes "Libro de Ventas" al fondo). */}
          {siiQueries && (
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/cobrar/facturas-emitidas" icon={FileText} label="Ver facturas" />
              <QuickLink href="/cobrar/clientes" icon={Users} label="Clientes" />
            </div>
          )}
        </header>
        {decisionBrief && <DecisionBriefSlot surface="cobrar" />}
        <CobrarV2Live siiEnabled={siiQueries} suppressRecommendations={decisionBrief} />
      </div>
    );
  }

  if (accountsReceivable) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
        </header>
        {decisionBrief && <DecisionBriefSlot surface="cobrar" />}
        <CobrarView siiEnabled={siiQueries} suppressRecommendations={decisionBrief} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
        </div>
        {siiQueries && (
          <QuickLink href="/cobrar/facturas-emitidas" icon={FileText} label="Ver facturas" />
        )}
      </header>

      {decisionBrief && <DecisionBriefSlot surface="cobrar" />}

      {!siiQueries && <FeatureUnavailableState />}

      <QavanteEmpty
        icon={ArrowDownToLine}
        title="Cobranza"
        description={
          decisionBrief
            ? "Conecta tus datos para ver lo que te deben."
            : "Todavía no hay cuentas por cobrar disponibles."
        }
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
