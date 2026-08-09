"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { QavanteCard } from "@/components/qavante";
import {
  useBudgetVsActual,
  budgetVsActualQueryOptions,
  useProposeBudget,
  type BudgetVsActualResponse,
} from "@/lib/api/planning";
import { currentPeriodSantiago, shiftPeriod } from "@/components/gestion/gestion-format";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";
import { PlanRealWidget, type PlanRealModo } from "./plan-real-widget";
import { mapPlanReal, agregarPlanReal, type PlanReal } from "./plan-real-model";

/* Contenedor del widget "Plan vs Real" (presupuesto vs real) del Inicio. MENSUAL = último mes cerrado;
   ANUAL = acumulado de los meses cerrados del año (suma vía `useQueries`). Ancla al mes CERRADO (el en
   curso engaña, misma honestidad que #880). Container: NO se testea por Storybook (ADR-0018); la lógica
   vive en `plan-real-model` (unit). Si no hay presupuesto cargado, muestra estado honesto (no inventa). */

export function PlanRealLive() {
  const [modo, setModo] = React.useState<PlanRealModo>("mes");

  const periodos = React.useMemo(() => {
    const actual = currentPeriodSantiago(new Date());
    const ultimoCerrado = shiftPeriod(actual, -1);
    const year = actual.slice(0, 4);
    // Meses CERRADOS del año en curso: YYYY-01 .. último cerrado (0 si estamos en enero).
    const meses: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const p = `${year}-${String(m).padStart(2, "0")}`;
      if (p <= ultimoCerrado && p.slice(0, 4) === year) meses.push(p);
    }
    return { ultimoCerrado, year, mesesAnio: meses };
  }, []);

  const mesQuery = useBudgetVsActual(periodos.ultimoCerrado, modo === "mes");
  const anioQueries = useQueries({
    queries: periodos.mesesAnio.map((p) => budgetVsActualQueryOptions(p, modo === "anio")),
  });
  // Presupuesto propositivo (ADR-0091): el dueño lo genera desde el histórico con un botón (no lo llena).
  const propose = useProposeBudget();

  const loading = modo === "mes" ? mesQuery.isLoading : anioQueries.some((q) => q.isLoading);

  const data: PlanReal | null = React.useMemo(() => {
    if (modo === "mes") return mapPlanReal(mesQuery.data, mesCorto(periodos.ultimoCerrado));
    const resps = anioQueries.map((q) => q.data as BudgetVsActualResponse | undefined);
    return agregarPlanReal(resps, `${periodos.year} a la fecha`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, mesQuery.data, anioQueries.map((q) => q.data).join(","), periodos]);

  // Con presupuesto → el widget. Sin él (o cargando) → tarjeta con el MISMO header (título + toggle),
  // así el dueño puede alternar Mes/Año aunque un modo no tenga plan cargado.
  if (data && data.tieneBudget && !loading) {
    return <PlanRealWidget data={data} modo={modo} onModoChange={setModo} />;
  }

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Plan vs Real</span>}
    >
      {/* Toggle debajo del header (no en top-right) para no chocar con el asa de arrastre. */}
      <div className="mb-1 flex justify-end">
        <div className="flex rounded-lg bg-neutral-light/40 p-0.5 text-xs" role="tablist">
          {(["mes", "anio"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={
                "rounded-md px-2 py-0.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary " +
                (modo === m ? "bg-surface text-neutral-strong shadow-sm" : "text-neutral-mid")
              }
            >
              {m === "mes" ? "Mes" : "Año"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-neutral-light/30" aria-busy="true" />
      ) : (
        <>
          <p className="py-3 text-sm text-neutral-mid">
            Todavía no tienes un presupuesto para {periodos.year}. Qavante te lo{" "}
            <strong className="font-semibold text-neutral-strong">propone desde tu histórico</strong>{" "}
            (no lo llenas a mano) y después lo ajustas.
          </p>
          <button
            type="button"
            onClick={() => propose.mutate({ fiscal_year: Number(periodos.year) })}
            disabled={propose.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            {propose.isPending ? "Proponiendo…" : "Proponer presupuesto"}
          </button>
          {propose.isError && (
            <p className="mt-2 text-xs text-danger-500">
              No pudimos proponer el presupuesto ahora. Vuelve a intentar en un momento.
            </p>
          )}
          <Link
            href="/gestion"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Ver gestión
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </>
      )}
    </QavanteCard>
  );
}
