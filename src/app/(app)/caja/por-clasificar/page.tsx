import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Skeleton gateado — Addendum Frontend v2.0 §17. Server Component, flag OFF
   por default (ADR-0008). Sin `export const runtime` (regla 4). Tabla de
   movimientos + ClassificationDrawer llegan post-handoff. El backend ya
   expone `/api/bank-movements/{id}/classify` (reconciliation P4-1) pero la
   integración real va en un PR posterior, tras la decisión del drift SII y
   confirmación oficial del handoff. Punto de entrada desde /caja queda
   diferido (la landing de Caja es placeholder C8) — addendum §17. */
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

      {!bankMovementClassification && <FeatureUnavailableState />}
      {/* bankMovementClassification === true (post-handoff): tabla de
          movimientos + ClassificationDrawer — addendum §17.1/§17.2. */}
    </div>
  );
}
