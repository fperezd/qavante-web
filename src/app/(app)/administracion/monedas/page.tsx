import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Skeleton gateado — Addendum Frontend v2.0 §16. Server Component, flag OFF
   por default (ADR-0008). Sin `export const runtime` (regla 4). El panel de
   configuración de monedas llega post-handoff (`/api/core/currencies` aún
   AUSENTE — reconciliation P4-1). */
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

      {!multiCurrency && <FeatureUnavailableState />}
      {/* multiCurrency === true (post-handoff): CurrencySettingsPanel —
          addendum §16.1/§16.2. PR posterior. */}
    </div>
  );
}
