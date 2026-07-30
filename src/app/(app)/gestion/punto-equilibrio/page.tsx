import { Target } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PuntoEquilibrioView } from "@/components/gestion/v2/punto-equilibrio-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";

/* Gestión → Punto de equilibrio (pedido de Fernando 2026-07-29, "las 3"). Gated
   `operationalResult` (ON en prod). Todo se deriva del operational-result; la
   vista degrada honesto si no es calculable. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult } = resolveFeatureFlags();
  const initialPeriod = currentPeriodSantiago(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Punto de equilibrio</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Cuánto necesitas vender al mes para no perder?
        </p>
      </header>

      {operationalResult ? (
        <PuntoEquilibrioView initialPeriod={initialPeriod} />
      ) : (
        <QavanteEmpty
          icon={Target}
          title="Punto de equilibrio"
          description="Muy pronto disponible."
        />
      )}
    </div>
  );
}
