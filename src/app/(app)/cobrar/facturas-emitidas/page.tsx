import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { FacturasEmitidasView } from "./view";

/* `/cobrar/facturas-emitidas` — RCV Ventas del SII (Sprint C1 PR-Sii3).
   Vive bajo Cobrar porque son facturas que yo emití a clientes → son
   ingresos por cobrar (modelo mental del PYME). Gateado por `siiQueries`
   (ADR-0008). */
export default function CobrarFacturasEmitidasPage() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Facturas emitidas</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Documentos de venta del SII por período: facturas, notas y otros documentos que vos le
          emitiste a tus clientes.
        </p>
      </header>

      {siiQueries ? <FacturasEmitidasView /> : <FeatureUnavailableState />}
    </div>
  );
}
