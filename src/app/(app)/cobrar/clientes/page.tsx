import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { MaestroLive } from "@/components/terminos/maestro-live";

/* Clientes (submenú de Cobrar) — TODOS los clientes con ventas del SII este año
   (no solo lo pendiente por cobrar), con el vencimiento derivado (emisión + término
   editable por cliente). Server Component: resuelve el flag; la fuente es el SII
   (siiQueries). Sin `export const runtime` (regla 4). */
export default function ClientesPage() {
  const { siiQueries } = resolveFeatureFlags();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Clientes</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Todos tus clientes del año y el vencimiento de cada venta.
        </p>
      </header>
      {siiQueries ? (
        <MaestroLive
          kind="ventas"
          titulo="Clientes"
          subtitulo="Todos los clientes con ventas registradas este año — no solo lo pendiente por cobrar. Ajusta el término de pago por cliente y se recalculan los vencimientos."
        />
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}
