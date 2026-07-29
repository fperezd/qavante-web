import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { FacturasEmitidasView } from "./view";
import { FacturasEmitidasViewV2 } from "./view-v2";

/* `/cobrar/facturas-emitidas` — Libro de Ventas del SII (Sprint C1 PR-Sii3 +
   mejoras PR-Lib 2026-05-24). Vive bajo Cobrar porque son facturas que yo
   emití a clientes → ingresos por cobrar (modelo mental PYME).
   Lenguaje en UI: "Libro de Ventas" (convención chilena), no "RCV Ventas"
   (jerga del API). Gateado por `siiQueries` (ADR-0008 + ADR-0012).
   `libroVentasV2` (OFF, rediseño 2026-07-13) tiene prioridad: respuesta de dueño
   arriba + tabla que sube + concentración lateral. Requiere `siiQueries` (misma
   fuente RCV). Con OFF, el libro clásico queda intacto. */
export default function CobrarFacturasEmitidasPage() {
  const { siiQueries, libroVentasV2 } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Facturas de venta</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Todas las facturas, notas de crédito/débito y boletas que le emitiste a tus clientes, por
          período. Filtra por tipo, folio o cliente.
        </p>
      </header>

      {siiQueries ? (
        libroVentasV2 ? (
          <FacturasEmitidasViewV2 />
        ) : (
          <FacturasEmitidasView />
        )
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}
