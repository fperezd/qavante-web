import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { CurrencySettingsView } from "@/components/monedas/currency-settings-view";

/* Gateado — Addendum Frontend v2.0 §15/§16. Server Component: resuelve el
   flag `multiCurrency` (default OFF — ADR-0008). Sin `export const runtime`
   (regla 4). Flag OFF → FeatureUnavailableState (sin cambio visible:
   /api/management/config no existe → fallback ADR-0008). Flag ON → vista
   read-only de Ajustes + Tipos de cambio cableada a datos reales (§15/§16).
   El PATCH de settings llega en un PR siguiente — defense in depth: la
   lista de TC ya estará lista cuando se agregue la edición. */
export default function MonedasPage() {
  const { multiCurrency } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Monedas</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Define la moneda principal de tu empresa y las monedas en que quieres ver tus reportes.
        </p>
      </header>

      {multiCurrency ? <CurrencySettingsView /> : <FeatureUnavailableState />}
    </div>
  );
}
