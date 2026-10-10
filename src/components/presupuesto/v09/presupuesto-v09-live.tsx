"use client";

import * as React from "react";
import {
  useBudgetByAccount,
  useBudgetClosingProjection,
  useBudgetGrid,
  useBudgetVsActual,
  useEditBudgetLine,
  useAcceptBudget,
  useProposeBudget,
} from "@/lib/api/planning";
import { useOperationalResult, useOperationalResultDocuments } from "@/lib/api/gestion";
import { ApiError } from "@/lib/api/errors";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { buildBudgetGrid } from "../budget-grid-model";
import { periodoDefaultV09 } from "./presupuesto-v09-model";
import { PresupuestoV09View, type CuentaAbiertaV09 } from "./presupuesto-v09-view";

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
 * una pregunta (Ley 10), igual que V16 · Remuneraciones.
 *
 * ── Drill-down (issue #101) ──────────────────────────────────────────────────────────────────
 * `budget-by-account` se pide SIEMPRE (no sólo al abrir una fila): alimenta tanto el drill-down
 * por concepto como el bucket fijo "Sin asignar", que la vista muestra sin que el dueño tenga que
 * expandir nada. `cuentaAbierta` SÍ es lazy — abrir una cuenta es lo único que dispara
 * `useOperationalResultDocuments`, igual que `drill` en `gestion-v08-live.tsx`.
 *
 * ── Proyección de cierre + "Ajustar plan" (CC-API #431) ─────────────────────────────────────────
 * `budget-closing-projection` se pide siempre (es un banner fijo de la pantalla, no algo que el
 * dueño tenga que abrir). La grilla anual (`budget-grid`) SÍ es lazy: sólo se pide cuando el
 * dueño abre el panel "Ajustar plan" — mismas mutations (`useEditBudgetLine`/`useAcceptBudget`)
 * que ya usa la pantalla Presupuesto Fase 1a (`presupuesto-view.tsx`), nunca un cálculo nuevo. */

export function PresupuestoV09Live(_props: { issueSucesor?: string } = {}) {
  void _props;
  const [periodo] = React.useState(() => periodoDefaultV09(new Date()));
  const [asOf] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [conceptoAbierto, setConceptoAbierto] = React.useState<
    "revenue" | "direct_cost" | "operating_expense" | "sin_asignar" | null
  >(null);
  const [cuentaAbierta, setCuentaAbierta] = React.useState<CuentaAbiertaV09 | null>(null);
  const [ajustarPlanAbierto, setAjustarPlanAbierto] = React.useState(false);

  const year = Number(periodo.slice(0, 4));

  const bvaQuery = useBudgetVsActual(periodo);
  const resultQuery = useOperationalResult(periodo);
  const propose = useProposeBudget();

  const porCuentaQuery = useBudgetByAccount(periodo);
  const documentosQuery = useOperationalResultDocuments(
    periodo,
    cuentaAbierta?.accountCode ?? "",
    cuentaAbierta != null,
  );

  const proyeccionQuery = useBudgetClosingProjection(year, asOf);

  const gridQuery = useBudgetGrid(year, ajustarPlanAbierto);
  const editLine = useEditBudgetLine(year);
  const acceptGrid = useAcceptBudget(year);
  const grid =
    gridQuery.data && gridQuery.data.has_budget ? buildBudgetGrid(gridQuery.data) : null;

  const periodoLabel = formatPeriodLabel(periodo);

  if (bvaQuery.isLoading) return <CargandoPresupuesto />;

  return (
    <PresupuestoV09View
      periodoLabel={periodoLabel}
      bva={bvaQuery.data}
      error={bvaQuery.isError ? motivo(bvaQuery.error) : null}
      onReintentar={() => void bvaQuery.refetch()}
      onProponer={() => propose.mutate({ fiscal_year: year })}
      proponiendo={propose.isPending}
      errorProponer={propose.isError}
      resultOperacional={resultQuery.data?.result}
      porCuenta={porCuentaQuery.data}
      porCuentaError={porCuentaQuery.isError ? motivo(porCuentaQuery.error) : null}
      onReintentarPorCuenta={() => void porCuentaQuery.refetch()}
      conceptoAbierto={conceptoAbierto}
      onAbrirConcepto={setConceptoAbierto}
      cuentaAbierta={cuentaAbierta}
      onAbrirCuenta={setCuentaAbierta}
      documentos={documentosQuery.data}
      documentosCargando={documentosQuery.isLoading}
      proyeccion={proyeccionQuery.data}
      proyeccionError={proyeccionQuery.isError ? motivo(proyeccionQuery.error) : null}
      onReintentarProyeccion={() => void proyeccionQuery.refetch()}
      ajustarPlanAbierto={ajustarPlanAbierto}
      onToggleAjustarPlan={() => setAjustarPlanAbierto((v) => !v)}
      grid={grid}
      gridCargando={gridQuery.isLoading}
      gridSaving={editLine.isPending}
      gridAccepting={acceptGrid.isPending}
      onEditarCeldaGrid={(accountId, impactType, month, montoSignado) =>
        editLine.mutate({ account_id: accountId, month, amount: montoSignado, impact_type: impactType })
      }
      onAceptarGrid={() => acceptGrid.mutate()}
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
        Estamos trayendo tu presupuesto y su comparación con el resultado real.
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
