import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ForeignPurchasesView } from "@/components/caja/foreign-purchases-view";

/* `/caja/compras-extranjero` — compras al extranjero (de la cartola de tarjeta).
   Lista + clasificación (concepto + categoría). Gateado por
   `bankMovementClassification` (mismo dominio: clasificar movimientos de tarjeta).
   Server Component (regla 4: sin export const runtime). */
export default function CajaComprasExtranjeroPage() {
  const { bankMovementClassification } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Compras al extranjero</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Compras en moneda extranjera de tus cartolas de tarjeta. Asigna concepto y categoría a
          cada una para que entren bien en tu gestión.
        </p>
      </header>

      {bankMovementClassification ? <ForeignPurchasesView /> : <FeatureUnavailableState />}
    </div>
  );
}
