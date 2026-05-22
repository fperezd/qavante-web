import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { RulesListView } from "@/components/reglas/rules-list-view";

/* Gateado — Addendum Frontend v2.0 §17.5/§17.6/§18.1. Server Component:
   resuelve el flag `classificationRules` (default OFF — ADR-0008). Sin
   `export const runtime` (regla 4). Flag OFF → FeatureUnavailableState
   (sin cambio visible: /api/management/config no existe → fallback
   ADR-0008). Flag ON → listado de reglas + toggle active. Create/edit en
   PRs siguientes; el banner §18.7 (suggest-rule desde drawer) tampoco
   acá — pertenece al drawer §17. */
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

      {classificationRules ? <RulesListView /> : <FeatureUnavailableState />}
    </div>
  );
}
