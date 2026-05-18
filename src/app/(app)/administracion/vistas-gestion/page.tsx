import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ManagementDimensionsView } from "@/components/clasificacion/management-dimensions-view";

/* Gateado — Addendum Frontend v2.0 §15. Server Component: resuelve el flag
   (default OFF — ADR-0008). Sin `export const runtime` (regla 4). Flag OFF →
   FeatureUnavailableState (sin cambio visible: /api/management/config no
   existe → fallback ADR-0008). Flag ON → vista read-only conectada a
   `/api/management/dimensions`. El grid + editor de valores jerárquicos es
   un PR posterior (addendum §15.2/§15.3). */
export default function VistasGestionPage() {
  const { managementDimensions } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Vistas de gestión</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Agrega formas de mirar tu negocio: por cliente, proyecto, obra, local, sociedad, activo,
          canal u otra variable relevante.
        </p>
      </header>

      {managementDimensions ? <ManagementDimensionsView /> : <FeatureUnavailableState />}
    </div>
  );
}
