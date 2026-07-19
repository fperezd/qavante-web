"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  siiKeys,
  type RcvComprasResponse,
  type RcvVentasResponse,
} from "@/lib/api/sii";
import type { RcvKind } from "../rcv-list-view";
import type { RcvDoc } from "../rcv-grouped-item";
import type { PeriodRange } from "@/lib/period/period-range";
import type { HeroComparativo } from "./ventas-hero";
import {
  calcularComparativos,
  netoDocs,
  netosYoY,
  planComparativoPeriodos,
  type ComparativosInput,
} from "./libro-comparativos";

/* Hook que enciende los 3 comparativos del ritmo del Libro v2 (Ventas o Compras)
   calculándolos EN EL FE (decisión de Fernando 2026-07-13: "FE ahora + pedir endpoint
   a CC-API"). Baja los meses que cada comparativo necesita vía useQueries —
   react-query DEDUPLICA con los meses que ya bajó la vista del rango (misma queryKey),
   así el costo extra es solo los meses fuera del rango. `retry: false`.

   Rigor / honestidad: un comparativo se calcula SOLO si TODOS sus meses cargaron con
   éxito (isSuccess). Si un mes falla o falta, ese comparativo se OMITE — nunca se
   muestra un % con base incompleta (un número de negocio equivocado es peor que
   ninguno). Cuando CC-API entregue el endpoint de comparativos (libro-comparativos-
   contract), esto se reemplaza por una sola llamada pre-agregada. */
export function useLibroComparativos(
  kind: RcvKind,
  range: PeriodRange,
  today: Date,
): { comparativos: HeroComparativo[]; isFetching: boolean } {
  const plan = React.useMemo(() => planComparativoPeriodos(range, today), [range, today]);

  const results = useQueries({
    queries: plan.periodos.map((periodo) => ({
      queryKey: kind === "ventas" ? siiKeys.rcvVentas({ periodo }) : siiKeys.rcvCompras({ periodo }),
      queryFn: () =>
        api.get<RcvVentasResponse | RcvComprasResponse>(
          `/api/sii/rcv/${kind}?periodo=${encodeURIComponent(periodo)}`,
        ),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  // periodo → docs SOLO si la query tuvo éxito; undefined = no disponible (fetching/error).
  const byPeriod = new Map<string, RcvDoc[] | undefined>();
  plan.periodos.forEach((p, i) => {
    const r = results[i];
    const data = r?.data as (RcvVentasResponse & RcvComprasResponse) | undefined;
    const docs = (kind === "ventas" ? data?.ventas : data?.compras) as RcvDoc[] | undefined;
    byPeriod.set(p, r?.isSuccess ? (docs ?? []) : undefined);
  });
  const has = (p: string) => byPeriod.get(p) !== undefined;
  const docs = (p: string) => byPeriod.get(p) ?? [];

  const input: ComparativosInput = { diaCorte: plan.diaCorte, labelMesAnterior: plan.labelMesAnterior };

  // (1) Este mes/período vs. misma fecha del mes anterior — necesita ambos meses.
  if (has(plan.mesActual) && has(plan.mesAnterior)) {
    input.mesActual = docs(plan.mesActual);
    input.mesAnterior = docs(plan.mesAnterior);
  }

  // (2) Mes anterior sobre el promedio del año — necesita el mes anterior + todos los
  //     meses del año en curso.
  if (plan.mesesAnio.length > 0 && plan.mesesAnio.every(has) && has(plan.mesAnterior)) {
    input.netoMesAnterior = netoDocs(docs(plan.mesAnterior));
    input.netosDelAnio = plan.mesesAnio.map((p) => netoDocs(docs(p)));
  }

  // (3) vs. año anterior — necesita el rango completo Y su equivalente del año pasado. El mes en
  //     curso (si está en el rango) se trunca a la fecha de corte en ambos años (no parcial vs completo).
  if (plan.rango.every(has) && plan.rangoAnioAnterior.every(has)) {
    const yoy = netosYoY(plan.rango, plan.rangoAnioAnterior, docs, plan.mesActual, plan.diaCorte);
    input.netoPeriodo = yoy.netoPeriodo;
    input.netoPeriodoAnioAnterior = yoy.netoPeriodoAnioAnterior;
  }

  return {
    comparativos: calcularComparativos(input),
    isFetching: results.some((r) => r.isFetching),
  };
}
