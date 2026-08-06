import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ObligacionesListView } from "@/components/pagar/obligaciones-list-view";

/* `/pagar/obligaciones` — Préstamos y obligaciones (Tesorería). Vive bajo Pagar
   porque son compromisos de pago. Alta de préstamo con amortización francesa +
   conciliación de cuotas contra débitos bancarios. Gateado por `obligations`
   (ADR-0008/0012). Server Component (regla 4: sin export const runtime). */
export default function PagarObligacionesPage() {
  const { obligations } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Obligaciones en cuotas</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tus compromisos de pago en cuotas: compras con la tarjeta (SII, TGR, proveedores) y
          préstamos, con sus cuotas pendientes y próximos vencimientos. Las cuotas se concilian
          automáticamente contra los débitos de tu banco.
        </p>
      </header>

      {obligations ? <ObligacionesListView /> : <FeatureUnavailableState />}
    </div>
  );
}
