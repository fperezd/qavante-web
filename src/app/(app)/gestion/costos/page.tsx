import { LineChart } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { GestionSeccionView } from "@/components/gestion/v2/gestion-seccion-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";

/* Gestión → En qué se va la plata (sub-menú, pedido de Fernando 2026-07-28). Gated
   `operationalResult`. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult } = resolveFeatureFlags();
  const initialPeriod = currentPeriodSantiago(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">En qué se va la plata</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tus costos y gastos del período, cuenta por cuenta.
        </p>
      </header>

      {operationalResult ? (
        <GestionSeccionView seccion="costos" initialPeriod={initialPeriod} />
      ) : (
        <QavanteEmpty
          icon={LineChart}
          title="En qué se va la plata"
          description="Muy pronto disponible."
        />
      )}
    </div>
  );
}
