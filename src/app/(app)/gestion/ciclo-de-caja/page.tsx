import { Clock } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CicloCajaView } from "@/components/gestion/v2/ciclo-caja-view";

/* Gestión → Ciclo de caja (pedido de Fernando 2026-07-29, "las 3"). Gated
   `operationalResult` (coherente con el resto de Gestión, ON en prod); el dato
   viene de `/api/treasury/cash-cycle` y la vista degrada sola si no es
   calculable. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Ciclo de caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Por qué ganas pero no tienes plata? Cuántos días tarda tu plata en volver.
        </p>
      </header>

      {operationalResult ? (
        <CicloCajaView />
      ) : (
        <QavanteEmpty icon={Clock} title="Ciclo de caja" description="Muy pronto disponible." />
      )}
    </div>
  );
}
