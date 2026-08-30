import { Target } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { redirect } from "next/navigation";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { destinoRutaVieja } from "@/components/gestion/v08/gestion-v08-model";
import { PuntoEquilibrioView } from "@/components/gestion/v2/punto-equilibrio-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";

/* Gestión → Punto de equilibrio (pedido de Fernando 2026-07-29, "las 3"). Gated
   `operationalResult` (ON en prod). Todo se deriva del operational-result; la
   vista degrada honesto si no es calculable. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult, gestionV08 } = resolveFeatureFlags();

  /* V08 · Gestión (#72): con `gestionV08` ENCENDIDO esta página deja de existir por su cuenta —
     su contenido vive como el bloque Punto de equilibrio de la tab Márgenes de `/gestion`. Se redirige en vez de dejar dos
     copias vivas del mismo número (Ley 1: un concepto, un lugar). Con el flag APAGADO, la página
     de siempre queda intacta → cero regresión. */
  if (gestionV08) redirect(destinoRutaVieja("/gestion/punto-equilibrio")!);
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
