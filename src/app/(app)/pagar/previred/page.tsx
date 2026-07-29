import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PreviredView } from "@/components/pagar/previred-view";

/* `/pagar/previred` — Imposiciones (cotizaciones previsionales) del mes que se
   pagan en Previred. Vive bajo Pagar como bucket propio (pedido de Fernando
   2026-07-28). Gateado por `remuneraciones` (la fuente del monto es la planilla
   de BUK). Sin `export const runtime` (regla 4). */
export default function PagarPreviredPage() {
  const { remuneraciones } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Previred</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Las imposiciones del mes — AFP, salud y seguro de cesantía — y cuándo vencen.
        </p>
      </header>

      {remuneraciones ? <PreviredView /> : <FeatureUnavailableState />}
    </div>
  );
}
