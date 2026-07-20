import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { MaestroLive } from "@/components/terminos/maestro-live";

/* Honorarios (submenú de Pagar) — TODOS los profesionales que te emitieron BHE este
   año (no solo lo pendiente por pagar), con el vencimiento derivado (emisión +
   término editable, default 5 días). Server Component: resuelve el flag; la fuente
   es el SII (siiQueries). Sin `export const runtime` (regla 4). */
export default function HonorariosPage() {
  const { siiQueries } = resolveFeatureFlags();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Honorarios</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Todos los profesionales que te emitieron boletas (BHE) este año y su vencimiento.
        </p>
      </header>
      {siiQueries ? (
        <MaestroLive
          kind="honorarios"
          titulo="Honorarios"
          subtitulo="Todos los profesionales con BHE emitidas este año — no solo lo pendiente por pagar. El término por defecto es 5 días; ajústalo por profesional."
        />
      ) : (
        <FeatureUnavailableState />
      )}
    </div>
  );
}
