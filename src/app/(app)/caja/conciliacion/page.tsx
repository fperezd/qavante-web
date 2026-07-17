import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ColaConciliacionLive } from "@/components/caja/conciliacion/cola-conciliacion-live";

/* Cola de conciliación (ADR-0036/0042). Server Component: resuelve el flag `reconciliationReview`
   (default OFF — ADR-0008). Sin `export const runtime` (regla 4). El motor auto-aplica los matches
   con score >=90 y deja los 60-90 acá, de a 1 clic. Flag OFF → FeatureUnavailableState. */
export default function ConciliacionPage() {
  const { reconciliationReview } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Conciliación</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Movimientos del banco que calzan con un documento, pero que Qavante no quiso dar por
          conciliados sin que los mires. Confirmá los que estén bien.
        </p>
      </header>

      {reconciliationReview ? <ColaConciliacionLive /> : <FeatureUnavailableState />}
    </div>
  );
}
