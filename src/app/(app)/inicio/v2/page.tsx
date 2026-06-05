import { Activity } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { InicioEjecutivoV2View } from "@/components/inicio/inicio-ejecutivo-v2-view";

/* Inicio Ejecutivo v2 (rediseño lente Xero) — ruta de staging `/inicio/v2`.
   **Server Component**: resuelve `dashboardSummary` en runtime del Worker (el v2
   usa el MISMO endpoint `GET /api/dashboard/summary` que el v1, con campos
   extendidos FE-first; por eso reusa su flag — no necesita uno propio). Flag ON
   → el rediseño (caja/runway al frente + tus fechas clave del mes + acciones).
   Default OFF → QavanteEmpty. Vive en una ruta aparte para no tocar el `/inicio`
   LIVE; el swap a la ruta principal es un cambio de una línea cuando se apruebe. */
export default function InicioV2Page() {
  const { dashboardSummary } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Inicio Ejecutivo</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cómo está mi empresa hoy?</p>
      </header>

      {dashboardSummary ? (
        <InicioEjecutivoV2View />
      ) : (
        <QavanteEmpty
          icon={Activity}
          title="Inicio Ejecutivo v2 — rediseño en preview"
          description="Esta es la versión rediseñada del Inicio: caja y runway al frente, tus fechas clave del mes (imposiciones, impuestos mensuales y sueldos) y acciones priorizadas. Se activa con el flag dashboardSummary."
        />
      )}
    </div>
  );
}
