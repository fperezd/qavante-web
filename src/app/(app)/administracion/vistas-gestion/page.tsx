import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Skeleton gateado — Addendum Frontend v2.0 §15. Server Component, flag OFF
   por default (ADR-0008). Sin `export const runtime` (regla 4). El grid de
   vistas + editor de valores jerárquicos llega post-handoff. */
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

      {!managementDimensions && <FeatureUnavailableState />}
      {/* managementDimensions === true (post-handoff): ManagementViewCardGrid
          + DimensionValueTreeEditor — addendum §15.2/§15.3. PR posterior. */}
    </div>
  );
}
