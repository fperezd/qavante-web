import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { FacturasRecibidasView } from "./view";

/* `/pagar/facturas-recibidas` — Libro de Compras del SII (Sprint C1 PR-Sii3 +
   mejoras PR-Lib 2026-05-24). Vive bajo Pagar porque son facturas que me
   emitieron proveedores → gastos que voy a pagar (modelo mental PYME).
   Lenguaje en UI: "Libro de Compras" (convención chilena del SII), no
   "RCV Compras" (jerga técnica del API). Gateado por `siiQueries`
   (ADR-0008 + ADR-0012). */
export default function PagarFacturasRecibidasPage() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Libro de Compras</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Documentos de compra del SII por período: facturas, notas de crédito/débito y boletas que
          te emitieron tus proveedores. Filtrá por tipo, folio o proveedor.
        </p>
      </header>

      {siiQueries ? <FacturasRecibidasView /> : <FeatureUnavailableState />}
    </div>
  );
}
