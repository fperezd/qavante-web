import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ObligacionDetailView } from "@/components/pagar/obligacion-detail-view";

/* `/pagar/obligaciones/[id]` — detalle de una obligación / préstamo (cabecera +
   calendario de cuotas). Gateado por `obligations`. Server Component; `params`
   es async en Next 15. Sin `export const runtime` (regla 4). */
export default async function PagarObligacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { obligations } = resolveFeatureFlags();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Detalle de la obligación</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Cabecera del préstamo y calendario de cuotas con su estado de pago.
        </p>
      </header>

      {obligations ? <ObligacionDetailView id={id} /> : <FeatureUnavailableState />}
    </div>
  );
}
