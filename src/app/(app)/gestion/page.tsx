import { LineChart } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { OperationalResultView } from "@/components/gestion/operational-result-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";

/* Gestión — Resultado Operacional (Sprint C5). Server Component: resuelve el
   flag `operationalResult` (default OFF — ADR-0008) y calcula el período
   inicial en America/Santiago (evita el bug del mes UTC del Worker). Flag ON →
   la vista cableada a `GET /api/management/operational-result` (contrato
   FE-first, gated hasta que el backend lo exponga). Sin `export const runtime`
   (regla 4). */
export default function GestionPage() {
  const { operationalResult } = resolveFeatureFlags();
  const initialPeriod = currentPeriodSantiago(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Gestión</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Estoy ganando o perdiendo operacionalmente?
        </p>
      </header>

      {operationalResult ? (
        <OperationalResultView initialPeriod={initialPeriod} />
      ) : (
        <QavanteEmpty
          icon={LineChart}
          title="Resultado Operacional — construcción en Sprint C5"
          description="Acá vas a ver tu Resultado Operacional de Gestión, drivers explicativos (qué cambió y por qué), Pulso Empresa detallado y comparativas mes a mes. Disponible al cerrar Sprint C5."
        />
      )}
    </div>
  );
}
