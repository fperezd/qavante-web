"use client";

import { useSiiRcvComparativos, type LibroComparativosResponse } from "@/lib/api/sii";
import { parseAmount } from "@/components/gestion/gestion-format";
import { orderRange, type PeriodRange } from "@/lib/period/period-range";
import type { RcvKind } from "../rcv-list-view";
import type { HeroComparativo } from "./ventas-hero";

/* Los 3 comparativos del ritmo del Libro v2 (Ventas o Compras) desde el endpoint PRE-AGREGADO del
   backend (`GET /api/sii/rcv/{kind}/comparativos?desde&hasta`, CC-API #766). Antes se calculaban EN EL
   FE bajando mes a mes (decisión de Fernando 2026-07-13: "FE ahora + pedir endpoint a CC-API"); ahora
   que el endpoint existe, se retira ese cálculo y se consume directo (un solo request, neto ya neteado
   de NC por el backend).

   Honestidad: un comparativo se muestra SOLO si su BASE es > 0 — no inventamos un % contra una base en
   cero (un número de negocio equivocado es peor que ninguno). El endpoint ya omite lo que no tiene en
   cache; acá filtramos además las bases nulas. */
export function toHeroComparativos(r: LibroComparativosResponse | undefined): HeroComparativo[] {
  if (!r) return [];
  const out: HeroComparativo[] = [];
  const md = r.mismo_dia_mes_anterior;
  if (md && parseAmount(md.neto_base) > 0) {
    out.push({ pct: md.pct, label: "este mes vs. misma fecha del mes anterior" });
  }
  const mp = r.mes_vs_promedio_anual;
  if (mp && parseAmount(mp.promedio_anual) > 0) {
    out.push({ pct: mp.pct, label: `${mp.mes_label} sobre el promedio mensual del año` });
  }
  const yoy = r.yoy;
  if (yoy && parseAmount(yoy.neto_anio_anterior) > 0) {
    out.push({ pct: yoy.pct, label: "vs. el mismo período del año anterior" });
  }
  return out;
}

export function useLibroComparativos(
  kind: RcvKind,
  range: PeriodRange,
): { comparativos: HeroComparativo[]; isFetching: boolean } {
  const { desde, hasta } = orderRange(range);
  const query = useSiiRcvComparativos(kind, desde, hasta);
  return {
    comparativos: toHeroComparativos(query.data),
    isFetching: query.isFetching,
  };
}
