import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Skeleton gateado — Addendum Frontend v2.0 §18. Server Component, flag OFF
   por default (ADR-0008). Sin `export const runtime` (regla 4). La tabla
   CRUD de reglas llega post-handoff (`/api/treasury/classification-rules`
   aún AUSENTE — reconciliation P4-1). */
export default function ReglasClasificacionPage() {
  const { classificationRules } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Reglas de clasificación</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Revisa las reglas que Qavante usa para clasificar movimientos similares en el futuro.
        </p>
      </header>

      {!classificationRules && <FeatureUnavailableState />}
      {/* classificationRules === true (post-handoff): tabla TanStack de reglas
          + ClassificationRuleModal — addendum §18.1. PR posterior. */}
    </div>
  );
}
