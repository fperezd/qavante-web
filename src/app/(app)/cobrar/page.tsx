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
import { CobrarV2Live } from "@/components/cobrar/v2/cobrar-v2-live";
import { MaestroLive } from "@/components/terminos/maestro-live";

/* Cobrar (Sprint C4). Server Component: resuelve los flags. `cobrarV2` ON → la
   respuesta de dueño ("a quién le cobras primero") + acciones reales de cobranza
   (tiene prioridad sobre la vista clásica, mismo dato base). `accountsReceivable`
   ON → la pantalla clásica (resumen + aging + top deudores + documentos). Flag OFF
   → comportamiento previo (card SII + placeholder C4). Sin `export const runtime`
   (regla 4). */
export default function CobrarPage() {
  const { siiQueries, accountsReceivable, cobrarV2 } = resolveFeatureFlags();

  if (cobrarV2) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
          <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
        </header>
        <CobrarV2Live siiEnabled={siiQueries} />
        {/* Maestro de clientes: control de vencimientos derivados (emisión + término
            editable) sobre las ventas del SII este año. Requiere SII conectado. */}
        {siiQueries && <MaestroLive kind="ventas" />}
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
        title="Cobranza"
        description="Aquí vas a ver tus documentos por cobrar ordenados por prioridad, la cobranza vencida, la antigüedad de saldos y acciones sugeridas por cliente. Muy pronto disponible."
      />
    </div>
  );
}
