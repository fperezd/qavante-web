import { LineChart } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { GestionSeccionView } from "@/components/gestion/v2/gestion-seccion-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";

/* Gestión → Comparativo (sub-menú, pedido de Fernando 2026-07-28). Gated
   `operationalResult`. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult } = resolveFeatureFlags();
  const initialPeriod = currentPeriodSantiago(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Comparativo</h1>
        <p className="mt-1 text-sm text-neutral-mid">Cómo vienes vs. los períodos anteriores.</p>
      </header>

      {operationalResult ? (
        <GestionSeccionView seccion="comparativo" initialPeriod={initialPeriod} />
      ) : (
        <QavanteEmpty icon={LineChart} title="Comparativo" description="Muy pronto disponible." />
      )}
    </div>
  );
}
