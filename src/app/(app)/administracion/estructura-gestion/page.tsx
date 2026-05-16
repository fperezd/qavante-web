import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Skeleton gateado — Addendum Frontend v2.0 §14. Server Component: el flag se
   resuelve en el server (resolveFeatureFlags lee process.env; default OFF —
   ADR-0008). NO declarar `export const runtime` (CLAUDE.md regla 4 /
   reconciliation P1-1). El editor de árbol real llega en un PR posterior,
   post-handoff backend confirmado. */
export default function EstructuraGestionPage() {
  const { managementAccounts } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Estructura de gestión</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Define cómo Qavante ordena tus ingresos, costos, gastos, caja y obligaciones. Puedes
          partir con la estructura sugerida y ajustarla a tu negocio.
        </p>
      </header>

      {!managementAccounts && <FeatureUnavailableState />}
      {/* managementAccounts === true (post-handoff): ManagementAccountTreeEditor
          + DetailPanel aquí — addendum §14.2/§14.3. PR posterior. */}
    </div>
  );
}
