import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CashFlowView } from "@/components/caja/cash-flow-view";

/* `/caja/proyeccion` — primer cableo Sprint C3 MVP. Muestra el reporte
   agregado del endpoint /api/treasury/reports/cash-flow tal cual viene del
   backend (sin inventar caja mínima ni acciones recomendadas; ver addendum
   frontend-v2 §25.3 y ADR-0008). Gated por `cashFlowReport` (default OFF;
   activar con NEXT_PUBLIC_FF_CASH_FLOW_REPORT=true en Cloudflare Workers
   cuando el usuario de prod tenga financial_impacts clasificados — ver
   ADR-0012). */
export default function CajaProyeccionPage() {
  const { cashFlowReport } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Caja proyectada</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Reporte agregado de entradas y salidas por período. Default ≈13 semanas con granularidad
          semanal sobre la capa comprometida (real).
        </p>
      </header>

      {cashFlowReport ? <CashFlowView /> : <FeatureUnavailableState />}
    </div>
  );
}
