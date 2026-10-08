import { FeatureUnavailableState } from "@/components/qavante";
import { AcuerdosLive } from "@/components/acuerdos/acuerdos-live";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* `/acuerdos` — listado de acuerdos financieros (web#178 / api#387). Un acuerdo PROPUESTO
 * (negotiating/offer_received/disputed) es sólo informativo: no cambia ningún escenario real.
 * Sólo uno FORMALIZADO sustituye el "en seguimiento" de Pagar/Cobrar y la proyección de caja. */
export default function AcuerdosPage() {
  const { financialAgreements } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Acuerdos financieros</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Negociaciones de pago o cobro distintas a lo declarado en el documento original. Sólo
          un acuerdo FORMALIZADO cambia la caja y reemplaza el seguimiento en Pagar/Cobrar.
        </p>
      </header>

      {financialAgreements ? <AcuerdosLive /> : <FeatureUnavailableState />}
    </div>
  );
}
