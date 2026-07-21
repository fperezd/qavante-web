import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CashFlowView } from "@/components/caja/cash-flow-view";
import { CajaV2ResumenLive } from "@/components/caja/v2/caja-v2-resumen-live";

/* `/caja/proyeccion` — primer cableo Sprint C3 MVP. Muestra el reporte
   agregado del endpoint /api/treasury/reports/cash-flow tal cual viene del
   backend (sin inventar caja mínima ni acciones recomendadas; ver addendum
   frontend-v2 §25.3 y ADR-0008). Gated por `cashFlowReport` (default OFF;
   activar con NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true en Cloudflare Workers
   cuando el usuario de prod tenga financial_impacts clasificados — ver
   ADR-0012). */
export default function CajaProyeccionPage() {
  const { cashFlowReport, cajaV2, cajaV3 } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja proyectada</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Reporte agregado de entradas y salidas por período. Por defecto muestra el mes actual y el
          siguiente, con granularidad semanal sobre la capa comprometida (real).
        </p>
      </header>

      {/* `cajaV2` (rediseño 2026-07-14) tiene prioridad: respuesta de dueño + curva de saldo.
         Requiere `cashFlowReport` (misma fuente de netos). Con OFF, el reporte clásico. */}
      {cajaV2 && cashFlowReport ? (
        <CajaV2ResumenLive cajaV3={cajaV3} />
      ) : cashFlowReport ? (
        <CashFlowView />
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}
