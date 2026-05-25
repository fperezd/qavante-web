import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ClasificadosView } from "@/components/clasificacion/clasificados-view";

/* `/caja/clasificados` — listado de movimientos bancarios ya clasificados
   (Sprint C2, complemento de `/caja/por-clasificar`). Útil para auditoría:
   ver qué quedó clasificado en un período, filtrar por categoría/dirección,
   y eventualmente reclasificar (esto último en un PR siguiente con drawer
   de edición). Gateado por `bankMovementClassification` (mismo flag que
   por-clasificar; ambos son parte del flujo §17). */
export default function CajaClasificadosPage() {
  const { bankMovementClassification } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Movimientos clasificados</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Auditoría de los movimientos bancarios ya clasificados. Filtra por categoría, dirección o
          período. Para reclasificar uno, ve a Por clasificar.
        </p>
      </header>

      {bankMovementClassification ? <ClasificadosView /> : <FeatureUnavailableState />}
    </div>
  );
}
