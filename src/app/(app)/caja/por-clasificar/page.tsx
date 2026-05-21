import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PorClasificarView } from "@/components/clasificacion/por-clasificar-view";

/* Gateado — Addendum Frontend v2.0 §17. Server Component: resuelve el flag
   (default OFF — ADR-0008). Sin `export const runtime` (regla 4). Flag OFF →
   FeatureUnavailableState (sin cambio visible: /api/management/config no
   existe → fallback ADR-0008). Flag ON → flujo §17 cableado a datos reales
   (lista de movimientos + ClassificationDrawer + PATCH classify). Punto de
   entrada desde /caja sigue diferido (landing de Caja es placeholder C8). */
export default function PorClasificarPage() {
  const { bankMovementClassification } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Movimientos por clasificar</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Revisa los movimientos que Qavante no pudo clasificar con suficiente confianza.
        </p>
      </header>

      {bankMovementClassification ? <PorClasificarView /> : <FeatureUnavailableState />}
    </div>
  );
}
