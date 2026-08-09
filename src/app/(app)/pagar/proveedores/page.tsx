import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { MaestroLive } from "@/components/terminos/maestro-live";

/* Proveedores (submenú de Pagar) — TODOS los proveedores con compras del SII este
   año (no solo lo pendiente por pagar), con el vencimiento derivado (emisión +
   término editable por proveedor). Server Component: resuelve el flag; la fuente es
   el SII (siiQueries). Sin `export const runtime` (regla 4). */
export default function ProveedoresPage() {
  const { siiQueries } = resolveFeatureFlags();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Proveedores</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Todos tus proveedores del año y el vencimiento de cada compra.
        </p>
      </header>
      {siiQueries ? (
        <MaestroLive
          kind="compras"
          titulo="Proveedores"
          subtitulo="Todos los proveedores con compras registradas este año, no solo lo pendiente por pagar. Ajusta el término de pago por proveedor y se recalculan los vencimientos."
        />
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}
