"use client";

import * as React from "react";
import { useBudgetVsActual, useProposeBudget } from "@/lib/api/planning";
import { useOperationalResult } from "@/lib/api/gestion";
import { ApiError } from "@/lib/api/errors";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { periodoDefaultV09 } from "./presupuesto-v09-model";
import { PresupuestoV09View } from "./presupuesto-v09-view";

/* Cableado de V09 · Presupuesto. La vista es presentacional; acá se resuelven las fuentes.
 *
 * `triada.real` SOLO viene de `budget-vs-actual` (Ley 1) — eso no cambió.
 *
 * RETRACTACIÓN (revisión adversarial, PR #102 vuelta 2): la vuelta 1 de este comentario decía que
 * "no hay una segunda consulta a operational-result... el invariante se fija con un test sobre
 * fixtures, no con una segunda llamada en runtime". Eso dejaba INV-FIN-001 ciego al número real:
 * un test sobre fixtures no puede detectar que el backend empezó a discrepar en producción. Por
 * eso este componente SÍ pide `operational-result` del mismo período — únicamente para el guard
 * `resultRealCoincideConResultado` (ver `presupuesto-v09-model.ts` / `presupuesto-v09-view.tsx`):
 * su `result` nunca reemplaza a `triada.real`, sólo se compara contra él. Si difieren, la vista
 * declara AMBOS números (Ley 1); si esta consulta secundaria falla o todavía no responde, el guard
 * simplemente no corre (no bloquea el resto de la pantalla — `bva` ya tiene sus propios estados de
 * "no sé"). Mismo hook que usa `gestion-v08-live.tsx` (`useOperationalResult`, `staleTime: 30_000`,
 * sin retry): si el usuario visitó Gestión hace poco, esta consulta sale de caché.
 *
 * Período: fijo al último mes CERRADO (`periodoDefaultV09`), sin selector — MVP de una pantalla,
 * una pregunta (Ley 10), igual que V16 · Remuneraciones. */

export function PresupuestoV09Live({ issueSucesor }: { issueSucesor?: string }) {
  const [periodo] = React.useState(() => periodoDefaultV09(new Date()));

  const bvaQuery = useBudgetVsActual(periodo);
  const resultQuery = useOperationalResult(periodo);
  const propose = useProposeBudget();

  const periodoLabel = formatPeriodLabel(periodo);

  if (bvaQuery.isLoading) return <CargandoPresupuesto />;

  return (
    <PresupuestoV09View
      periodoLabel={periodoLabel}
      bva={bvaQuery.data}
      error={bvaQuery.isError ? motivo(bvaQuery.error) : null}
      onReintentar={() => void bvaQuery.refetch()}
      onProponer={() => propose.mutate({ fiscal_year: Number(periodo.slice(0, 4)) })}
      proponiendo={propose.isPending}
      errorProponer={propose.isError}
      issueSucesor={issueSucesor}
      resultOperacional={resultQuery.data?.result}
    />
  );
}

/** Por qué no llegó, en lenguaje de dueño (mismo patrón que `gestion-v08-live.tsx`). */
export function motivo(err: unknown): string {
  if (err instanceof ApiError && err.isNetworkError()) {
    return "No pudimos conectar con Planificación (error de red). Vuelve a intentar en un momento.";
  }
  return "Planificación no respondió. Vuelve a intentar en un momento; si sigue igual, revisa tus conexiones.";
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. */
function CargandoPresupuesto() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="text-sm text-rediseno-tinta-3">
        Estamos trayendo tu presupuesto vs. real (~3 s).
      </p>
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-[14px] bg-rediseno-neutro-bg" aria-hidden="true" />
    </div>
  );
}
