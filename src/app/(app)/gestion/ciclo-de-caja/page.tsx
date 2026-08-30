import { Clock } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { redirect } from "next/navigation";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { destinoRutaVieja } from "@/components/gestion/v08/gestion-v08-model";
import { CicloCajaView } from "@/components/gestion/v2/ciclo-caja-view";

/* Gestión → Ciclo de caja (pedido de Fernando 2026-07-29, "las 3"). Gated
   `operationalResult` (coherente con el resto de Gestión, ON en prod); el dato
   viene de `/api/treasury/cash-cycle` y la vista degrada sola si no es
   calculable. Sin `export const runtime` (regla 4). */
export default function Page() {
  const { operationalResult, comportamientoPago, gestionV08 } = resolveFeatureFlags();

  /* V08 · Gestión (#72): con `gestionV08` ENCENDIDO esta página deja de existir por su cuenta —
     su contenido vive como el bloque Ciclo de caja de la tab Márgenes de `/gestion`. Se redirige en vez de dejar dos
     copias vivas del mismo número (Ley 1: un concepto, un lugar). Con el flag APAGADO, la página
     de siempre queda intacta → cero regresión. */
  if (gestionV08) redirect(destinoRutaVieja("/gestion/ciclo-de-caja")!);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Ciclo de caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Por qué ganas pero no tienes plata? Cuántos días tarda tu plata en volver.
        </p>
      </header>

      {operationalResult ? (
        <CicloCajaView comportamientoEnabled={comportamientoPago} />
      ) : (
        <QavanteEmpty icon={Clock} title="Ciclo de caja" description="Muy pronto disponible." />
      )}
    </div>
  );
}
