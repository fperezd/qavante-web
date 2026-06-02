import Link from "next/link";
import { ArrowDownToLine, FileOutput } from "lucide-react";
import {
  FeatureUnavailableState,
  QavanteBadge,
  QavanteCard,
  QavanteEmpty,
} from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CobrarView } from "@/components/cobrar/cobrar-view";

/* Cobrar (Sprint C4). Server Component: resuelve los flags. `accountsReceivable`
   ON → la pantalla completa (resumen + aging + top deudores + documentos,
   contrato FE-first); el link al Libro de Ventas SII va dentro (si `siiQueries`).
   Flag OFF → comportamiento previo (card SII + placeholder C4). Sin
   `export const runtime` (regla 4). */
export default function CobrarPage() {
  const { siiQueries, accountsReceivable } = resolveFeatureFlags();

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
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
      </header>

      {siiQueries ? (
        <section aria-labelledby="sii-section" className="space-y-3">
          <h2 id="sii-section" className="text-base font-semibold text-neutral-dark">
            Desde el SII
          </h2>
          <Link
            href="/cobrar/facturas-emitidas"
            className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <QavanteCard
              variant="bordered"
              className="transition-colors hover:border-brand-primary/40"
              header={
                <div className="flex items-center gap-2">
                  <FileOutput className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  <span className="font-medium">Libro de Ventas</span>
                </div>
              }
            >
              <div className="space-y-2">
                <QavanteBadge variant="success">SII</QavanteBadge>
                <p className="text-sm text-neutral-mid">
                  Documentos de venta del SII por período: facturas, notas y boletas que le emitiste
                  a tus clientes.
                </p>
              </div>
            </QavanteCard>
          </Link>
        </section>
      ) : (
        <FeatureUnavailableState />
      )}

      <QavanteEmpty
        icon={ArrowDownToLine}
        title="Cobranza — construcción en Sprint C4"
        description="Acá vas a ver tus documentos por cobrar ordenados por prioridad, cobranza vencida, antigüedad de saldos y acciones sugeridas por cliente. Disponible al cerrar Sprint C4."
      />
    </div>
  );
}
