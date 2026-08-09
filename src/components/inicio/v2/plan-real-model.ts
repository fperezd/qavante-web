/* Modelo PURO del widget "Plan vs Real" (presupuesto vs real) del Inicio — la vista contable clásica que
   un dueño está acostumbrado a ver. Sin React → testeable. Fuente: /api/planning/budget-vs-actual
   (por línea de P&L). Soporta MENSUAL (un período) y ANUAL (acumulado = suma de meses).
   Honestidad: si `has_budget=false` no inventamos un plan; el contenedor muestra estado honesto. */

import type { BudgetVsActualResponse, BudgetLine } from "@/lib/api/planning";
import { parseAmount } from "@/components/gestion/gestion-format";

export type PlanRealConcepto = BudgetLine["concept"]; // revenue | direct_cost | operating_expense | result

/** Orden y etiqueta de cada línea del P&L (como en un estado de resultados). */
const CONCEPTOS: { concepto: PlanRealConcepto; label: string }[] = [
  { concepto: "revenue", label: "Ingresos" },
  { concepto: "direct_cost", label: "Costo directo" },
  { concepto: "operating_expense", label: "Gastos operacionales" },
  { concepto: "result", label: "Resultado" },
];

/** Los montos de `budget-vs-actual` son SIGNADOS (revenue +, costos/gastos −, `result` = suma; contrato
 *  ADR-0091 confirmado por CC-API 2026-08-08). Con signo, `variance = actual − budget > 0` es SIEMPRE
 *  favorable (más ingreso O menos costo) → el MISMO coloreo para todas las líneas, sin invertir por tipo. */
function esFavorable(variacion: number): boolean {
  return variacion >= 0;
}

export interface PlanRealFila {
  concepto: PlanRealConcepto;
  label: string;
  /** Presupuestado (plan). */
  plan: number;
  /** Realizado (real). */
  real: number;
  /** real − plan (con signo). */
  variacion: number;
  /** variacion / |plan| * 100; `null` si plan = 0. */
  variacionPct: number | null;
  /** `true` si la desviación es buena para el negocio. */
  favorable: boolean;
}

export interface PlanReal {
  /** Etiqueta del período (ej. "julio" o "2026 a la fecha"). */
  periodoLabel: string;
  /** `false` si no hay presupuesto cargado (no mostramos plan/real inventado). */
  tieneBudget: boolean;
  /** Filas del P&L en orden (ingresos → resultado). */
  filas: PlanRealFila[];
  /** La fila "resultado" (para el titular); `null` si no vino. */
  resultado: PlanRealFila | null;
}

function fila(concepto: PlanRealConcepto, label: string, plan: number, real: number): PlanRealFila {
  const variacion = real - plan;
  return {
    concepto,
    label,
    plan,
    real,
    variacion,
    variacionPct: plan !== 0 ? Math.round((variacion / Math.abs(plan)) * 100) : null,
    favorable: esFavorable(variacion),
  };
}

/** Mensual: un `BudgetVsActualResponse` → filas en orden de P&L. */
export function mapPlanReal(
  resp: BudgetVsActualResponse | undefined,
  periodoLabel: string,
): PlanReal | null {
  if (!resp) return null;
  const porConcepto = new Map<PlanRealConcepto, BudgetLine>();
  for (const l of resp.lines ?? []) porConcepto.set(l.concept, l);
  const filas = CONCEPTOS.map(({ concepto, label }) => {
    const l = porConcepto.get(concepto);
    return fila(concepto, label, parseAmount(l?.budget), parseAmount(l?.actual));
  });
  return {
    periodoLabel,
    tieneBudget: resp.has_budget,
    filas,
    resultado: filas.find((f) => f.concepto === "result") ?? null,
  };
}

/** Anual (acumulado): suma plan y real por concepto sobre varios meses, recalcula variación. */
export function agregarPlanReal(
  resps: (BudgetVsActualResponse | undefined)[],
  periodoLabel: string,
): PlanReal | null {
  const validos = resps.filter((r): r is BudgetVsActualResponse => Boolean(r));
  if (!validos.length) return null;
  const sumaPlan = new Map<PlanRealConcepto, number>();
  const sumaReal = new Map<PlanRealConcepto, number>();
  for (const r of validos) {
    for (const l of r.lines ?? []) {
      sumaPlan.set(l.concept, (sumaPlan.get(l.concept) ?? 0) + parseAmount(l.budget));
      sumaReal.set(l.concept, (sumaReal.get(l.concept) ?? 0) + parseAmount(l.actual));
    }
  }
  const filas = CONCEPTOS.map(({ concepto, label }) =>
    fila(concepto, label, sumaPlan.get(concepto) ?? 0, sumaReal.get(concepto) ?? 0),
  );
  return {
    periodoLabel,
    tieneBudget: validos.some((r) => r.has_budget),
    filas,
    resultado: filas.find((f) => f.concepto === "result") ?? null,
  };
}
