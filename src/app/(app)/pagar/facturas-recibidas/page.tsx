import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { FacturasRecibidasView } from "./view";

/* `/pagar/facturas-recibidas` — RCV Compras del SII (Sprint C1 PR-Sii3).
   Vive bajo Pagar porque son facturas que me emitieron proveedores → son
   gastos que voy a pagar (modelo mental del PYME). El SII es la fuente
   técnica; el user ve "facturas recibidas", no "RCV Compras" (Anexo F).
   Gateado por `siiQueries` (ADR-0008). */
export default function PagarFacturasRecibidasPage() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Facturas recibidas</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Documentos de compra del SII por período: facturas, notas y otros documentos que te
          emitieron tus proveedores.
        </p>
      </header>

      {siiQueries ? <FacturasRecibidasView /> : <FeatureUnavailableState />}
    </div>
  );
}
