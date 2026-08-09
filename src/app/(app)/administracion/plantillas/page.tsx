import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { TemplatesGalleryView } from "@/components/plantillas/templates-gallery-view";

/* Gateado — Addendum Frontend v2.0 §13/§14. Server Component: resuelve el
   flag `industryTemplates` (default OFF — ADR-0008). Sin `export const
   runtime` (regla 4). Flag OFF → FeatureUnavailableState. Flag ON →
   galería de plantillas por rubro con preview de "qué pasaría si"
   (mode=suggest_only del §14.1, NUNCA destructivo). La aplicación real
   (mode=add_missing/replace_visibility) viene en un dialog confirmatorio
   en un PR siguiente — defense in depth. */
export default function PlantillasPage() {
  const { industryTemplates } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Plantillas por rubro</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Estructura sugerida de cuentas y vistas de gestión según el tipo de negocio que tengas.
          Solo sugerimos: Qavante nunca borra ni pisa datos.
        </p>
      </header>

      {industryTemplates ? <TemplatesGalleryView /> : <FeatureUnavailableState />}
    </div>
  );
}
