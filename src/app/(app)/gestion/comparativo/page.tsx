import { LineChart } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { redirect } from "next/navigation";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { destinoRutaVieja } from "@/components/gestion/v08/gestion-v08-model";
import { ComparativoView } from "@/components/gestion/v2/comparativo-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";

/* Gestión → Comparativo (sub-menú, pedido de Fernando 2026-07-28). Gated
   `operationalResult`. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult, gestionV08 } = resolveFeatureFlags();

  /* V08 · Gestión (#72): con `gestionV08` ENCENDIDO esta página deja de existir por su cuenta —
     su contenido vive como la tab Comparativo de `/gestion`. Se redirige en vez de dejar dos
     copias vivas del mismo número (Ley 1: un concepto, un lugar). Con el flag APAGADO, la página
     de siempre queda intacta → cero regresión. */
  if (gestionV08) redirect(destinoRutaVieja("/gestion/comparativo")!);
  const initialPeriod = currentPeriodSantiago(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Comparativo</h1>
        <p className="mt-1 text-sm text-neutral-mid">Cómo vienes vs. los períodos anteriores.</p>
      </header>

      {operationalResult ? (
        <ComparativoView initialPeriod={initialPeriod} />
      ) : (
        <QavanteEmpty icon={LineChart} title="Comparativo" description="Muy pronto disponible." />
      )}
    </div>
  );
}
