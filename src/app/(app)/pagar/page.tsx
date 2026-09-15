import Link from "next/link";
import { ArrowUpFromLine, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FeatureUnavailableState, QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PagarView } from "@/components/pagar/pagar-view";
import { PagarV2ViewLive } from "@/components/pagar/v2/pagar-v2-view-live";
import { PagarV05Live } from "@/components/pagar/v05/pagar-v05-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";

/* Pagar (Sprint C4). Server Component: resuelve los flags. La landing quedó limpia
   (pedido de Fernando 2026-07-28): el hero de prioridad + "Ver facturas" arriba.
   La navegación por tipo (Proveedores, Honorarios, Remuneraciones, Previred,
   Impuestos y TGR, Préstamos) vive ahora en el SIDEBAR (sub-ítems de Pagar), no
   como tarjetas acá. Sin `export const runtime` (regla 4). */
export default function PagarPage() {
  const { siiQueries, accountsPayable, pagarV2, pagarV05, decisionBrief } = resolveFeatureFlags();

  /* V05 · Pagar (rediseño Fase 2, issue #70) — gated por `pagarV05`, HOY APAGADO. Reemplaza la
     landing entera por la vista de la spec (una pantalla, una pregunta: "¿a quién le pago, y qué
     es crítico?"). Con OFF nada de abajo cambia (cero regresión: producción sigue sirviendo el
     Pagar clásico). Se conserva el acceso "Ver facturas": es la ruta de detalle a la que la tabla
     enlaza por fila. */
  if (pagarV05) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
            <p className="mt-1 text-sm text-neutral-mid">
              {decisionBrief
                ? "Pagos y compromisos de tu empresa."
                : "¿A quién le pago, y qué es crítico?"}
            </p>
          </div>
          {siiQueries && (
            <QuickLink href="/pagar/facturas-recibidas" icon={FileText} label="Ver facturas" />
          )}
        </header>
        {decisionBrief && <DecisionBriefSlot surface="pagar" />}
        <PagarV05Live suppressRecommendations={decisionBrief} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            {decisionBrief
              ? "Pagos y compromisos de tu empresa."
              : "¿A quién le pago y qué pagos son críticos?"}
          </p>
        </div>
        {/* "Ver facturas" arriba y a mano (antes "Libro de Compras (SII)" al fondo). */}
        {siiQueries && (
          <QuickLink href="/pagar/facturas-recibidas" icon={FileText} label="Ver facturas" />
        )}
      </header>

      {decisionBrief && <DecisionBriefSlot surface="pagar" />}

      {/* `pagarV2` (rediseño 2026-07-14) tiene prioridad: respuesta de dueño + brecha de caja.
         Requiere `accountsPayable` (misma fuente). Con OFF, el Pagar clásico intacto. */}
      {pagarV2 && accountsPayable ? (
        <PagarV2ViewLive suppressRecommendations={decisionBrief} />
      ) : (
        accountsPayable && <PagarView suppressRecommendations={decisionBrief} />
      )}

      {!accountsPayable && !siiQueries && <FeatureUnavailableState />}

      {!accountsPayable && (
        <QavanteEmpty
          icon={ArrowUpFromLine}
          title="Pagos a proveedores"
          description={
            decisionBrief
              ? "Aquí vas a ver los pagos y compromisos registrados cuando haya fuentes conectadas."
              : "Aquí vas a ver tus pagos pendientes priorizados, los pagos críticos por vencer, recordatorios y proveedores frecuentes. Muy pronto disponible."
          }
        />
      )}
    </div>
  );
}

/** Acceso secundario arriba (pill): "Ver facturas". */
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
