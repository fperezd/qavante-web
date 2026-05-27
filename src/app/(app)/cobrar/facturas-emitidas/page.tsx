import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { FacturasEmitidasView } from "./view";

/* `/cobrar/facturas-emitidas` — Libro de Ventas del SII (Sprint C1 PR-Sii3 +
   mejoras PR-Lib 2026-05-24). Vive bajo Cobrar porque son facturas que yo
   emití a clientes → ingresos por cobrar (modelo mental PYME).
   Lenguaje en UI: "Libro de Ventas" (convención chilena), no "RCV Ventas"
   (jerga del API). Gateado por `siiQueries` (ADR-0008 + ADR-0012). */
export default function CobrarFacturasEmitidasPage() {
  const { siiQueries } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Libro de Ventas</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Documentos de venta del SII por período: facturas, notas de crédito/débito y boletas que
          le emitiste a tus clientes. Filtra por tipo, folio o cliente.
        </p>
      </header>

      {siiQueries ? <FacturasEmitidasView /> : <FeatureUnavailableState />}
    </div>
  );
}
