import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { HonorariosRecibidosView } from "./view";

/* `/pagar/honorarios-recibidos` — BHE recibidas del SII (Sprint C1
   PR-Sii3). Vive bajo Pagar porque son honorarios que me cobran
   profesionales → son gastos que voy a pagar (modelo mental PYME).
   Diferencia clave vs facturas-recibidas: tiene retención del 13.75%
   (2026) que el pagador adelanta al SII. Gateado por `siiQueries`. */
export default function PagarHonorariosRecibidosPage() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Honorarios recibidos</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Boletas de Honorarios Electrónicas (BHE) que te emitieron profesionales por sus servicios.
          Vas a ver el monto bruto, la retención y el monto líquido por período.
        </p>
      </header>

      {siiQueries ? <HonorariosRecibidosView /> : <FeatureUnavailableState />}
    </div>
  );
}
