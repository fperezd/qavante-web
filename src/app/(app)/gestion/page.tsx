import { LineChart } from "lucide-react";
import { Suspense } from "react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { OperationalResultView } from "@/components/gestion/operational-result-view";
import { currentPeriodSantiago } from "@/components/gestion/gestion-format";
import { GestionV08Live } from "@/components/gestion/v08/gestion-v08-live";
import { OperationalResultV2Panel } from "@/components/gestion/operational-result-v2-panel";
import { OperationalResultCorridoPanel } from "@/components/gestion/operational-result-corrido-panel";

/* Gestión — Resultado Operacional (Sprint C5). Server Component: resuelve el
   flag `operationalResult` (default OFF — ADR-0008) y calcula el período
   inicial en America/Santiago (evita el bug del mes UTC del Worker). Flag ON →
   la vista cableada a `GET /api/management/operational-result` (contrato
   FE-first, gated hasta que el backend lo exponga). Sin `export const runtime`
   (regla 4). */
export default function GestionPage() {
  const { operationalResult, gestionDashboard, gestionV08 } = resolveFeatureFlags();
  const initialPeriod = currentPeriodSantiago(new Date());

  /* V08 · Gestión (rediseño Fase 2, issue #72) — gated por `gestionV08`, HOY APAGADO en producción
     (no está en `wrangler.toml`). Reemplaza
     las NUEVE páginas de `/gestion` por una vista con seis tabs (spec §V08). Con OFF nada de abajo
     cambia y las ocho sub-rutas siguen sirviendo su página propia → cero regresión. `Suspense`
     porque la vista lee `?tab=` con `useSearchParams` (requisito de Next para prerender). */
  if (gestionV08) {
    return (
      <div className="space-y-5">
        {/* Orden de lectura: primero LO CORRIDO (lo que ya ocurrió, que es lo que el dueño
            pregunta al abrir Gestión), después el HORIZONTE, y al final el detalle mensual. */}
        <OperationalResultCorridoPanel initialPeriod={initialPeriod} />
        <OperationalResultV2Panel />
        <Suspense fallback={<CargandoGestion />}>
          <GestionV08Live />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Gestión</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Estoy ganando o perdiendo operacionalmente?
        </p>
      </header>

      {/* Dos bloques, el mismo diseño, rótulos distintos, y cada uno declarando qué período
          cubre. Lo CORRIDO va primero porque es la respuesta a "¿estoy ganando o perdiendo?";
          el HORIZONTE es contexto de lo que viene (y hoy está abstenido en producción, así que
          abrir la pantalla con él sería abrir con una abstención). La matriz mensual queda al
          final como el detalle al que se baja después de leer las dos cifras. */}
      <OperationalResultCorridoPanel initialPeriod={initialPeriod} />
      <OperationalResultV2Panel />

      {operationalResult ? (
        <OperationalResultView initialPeriod={initialPeriod} dashboard={gestionDashboard} />
      ) : (
        <QavanteEmpty
          icon={LineChart}
          title="Resultado Operacional"
          description="Aquí vas a ver tu Resultado Operacional de Gestión, los factores que lo explican (qué cambió y por qué), tu Pulso Empresa en detalle y comparativas mes a mes. Muy pronto disponible."
        />
      )}
    </div>
  );
}

function CargandoGestion() {
  return (
    <p className="text-sm text-rediseno-tinta-3" aria-busy="true" aria-live="polite">
      Estamos armando tu Gestión con la información disponible.
    </p>
  );
}
