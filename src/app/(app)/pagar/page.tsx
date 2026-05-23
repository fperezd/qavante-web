import Link from "next/link";
import { ArrowUpFromLine, Receipt } from "lucide-react";
import {
  FeatureUnavailableState,
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
} from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Landing del módulo Pagar. El módulo completo (pagos priorizados,
   alertas críticas, proveedores frecuentes) llega en Sprint C4. Mientras
   tanto, este screen muestra las sub-secciones ya disponibles —
   Impuestos del SII (Sprint C1) — antes del empty state del módulo. */
export default function PagarPage() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Qué debo pagar y qué pagos son críticos?</p>
      </header>

      {siiQueries ? (
        <section aria-labelledby="impuestos-section" className="space-y-3">
          <h2 id="impuestos-section" className="text-base font-semibold text-neutral-dark">
            Impuestos
          </h2>
          <Link
            href="/pagar/impuestos"
            className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <QavanteCard
              variant="bordered"
              className="transition-colors hover:border-brand-primary/40"
              header={
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  <span className="font-medium">Impuestos del SII</span>
                </div>
              }
            >
              <div className="space-y-2">
                <QavanteBadge variant="success">F29 disponible</QavanteBadge>
                <p className="text-sm text-neutral-mid">
                  Consultá tu F29 mensual por folio y descargá el PDF del Certificado Solemne.
                  Próximamente: F22 anual.
                </p>
              </div>
            </QavanteCard>
          </Link>
        </section>
      ) : (
        <FeatureUnavailableState />
      )}

      <QavanteEmpty
        icon={ArrowUpFromLine}
        title="Pagos a proveedores — construcción en Sprint C4"
        description="Acá vas a ver tus pagos pendientes priorizados, pagos críticos por vencer, recordatorios y proveedores frecuentes. Disponible al cerrar Sprint C4."
      />
    </div>
  );
}
