/* Modelo PURO del widget "Plan vs Real" (presupuesto vs real) del Inicio — la vista contable clásica que
   un dueño está acostumbrado a ver. Sin React → testeable. Fuente: /api/planning/budget-vs-actual
   (por línea de P&L). Soporta MENSUAL (un período) y ANUAL (acumulado = suma de meses).
   Honestidad: si `has_budget=false` no inventamos un plan; el contenedor muestra estado honesto.

   ── LEY 1 (qavante-web#103) — MENSUAL no recalcula `variance`/`variance_pct` ─────────────────
   `BudgetLine` YA trae `variance` (actual − budget) y `variance_pct` calculados por el backend
   (mismo contrato que lee `presupuesto-v09-model.ts`). Antes, `fila()` los ignoraba y volvía a
   calcular `real - plan` + `Math.round(... * 100)` — el redondeo a ENTERO en el CÁLCULO (no en la
   presentación) hacía que donde el backend decía 21,1 % el widget mostrara 21 %: dos números para
   el mismo concepto en dos pantallas (V09 ya leía el campo tal cual). MENSUAL ahora lee `variance`/
   `variance_pct` del backend, sin recalcular; el redondeo a 1 decimal lo hace `formatPct` sólo al
   momento de pintar (`plan-real-widget.tsx`), igual que en V09 y en `presupuesto-view.tsx`.
   ANUAL (`agregarPlanReal`) sigue derivando: el backend no expone un `budget-vs-actual` de RANGO
   (sólo por período mensual), así que el acumulado sólo puede construirse sumando plan/real de cada
   mes — eso no es "recalcular sobre una fuente que ya lo entrega", es la única forma de agregar.
   Como la suma es lineal, `Σreal − Σplan == Σ(real−plan) == Σvariance` de cada mes: el monto agregado
   coincide con lo que el backend habría calculado si expusiera ese rango. */

import type { BudgetVsActualResponse, BudgetLine } from "@/lib/api/planning";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";

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
  /** MENSUAL: `BudgetLine.variance` del backend, tal cual (no `real - plan` recalculado). ANUAL:
   *  suma de los `variance` mensuales (== `real - plan` sobre los TOTALES ya sumados; ver cabecera
   *  del módulo). */
  variacion: number;
  /** MENSUAL: `BudgetLine.variance_pct` del backend, tal cual (sin redondear — el redondeo a 1
   *  decimal es de PRESENTACIÓN, ver `formatPct`). ANUAL: `variacion / |plan| * 100` sobre los
   *  totales agregados (no hay `variance_pct` de backend para un rango). `null` si `plan = 0` (no
   *  dividir por cero) sólo en ANUAL; MENSUAL conserva el `0` que declara el backend. */
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

/** `desdeBackend`: `{ variance, variancePct }` de la línea `BudgetLine` cuando existe (MENSUAL) — se
 *  leen tal cual, sin recalcular. Si no viene (línea ausente, o ANUAL agregando varios meses), se
 *  deriva `variacion = real - plan` y `variacionPct = variacion / |plan| * 100` (`null` si plan = 0
 *  sólo al derivar; cuando viene del backend se conserva incluso el `0` contractual). */
function fila(
  concepto: PlanRealConcepto,
  label: string,
  plan: number,
  real: number,
  desdeBackend?: { variance: number; variancePct: number | null },
): PlanRealFila {
  const variacion = desdeBackend ? desdeBackend.variance : real - plan;
  const variacionPct = desdeBackend
    ? desdeBackend.variancePct
    : plan === 0
      ? null
      : (variacion / Math.abs(plan)) * 100;
  return {
    concepto,
    label,
    plan,
    real,
    variacion,
    variacionPct,
    favorable: esFavorable(variacion),
  };
}

/** Mensual: un `BudgetVsActualResponse` → filas en orden de P&L. Lee `variance`/`variance_pct` de
 *  cada `BudgetLine` tal cual (Ley 1, qavante-web#103) — nunca los recalcula. */
export function mapPlanReal(
  resp: BudgetVsActualResponse | undefined,
  periodoLabel: string,
): PlanReal | null {
  if (!resp) return null;
  const porConcepto = new Map<PlanRealConcepto, BudgetLine>();
  for (const l of resp.lines ?? []) porConcepto.set(l.concept, l);
  const filas = CONCEPTOS.map(({ concepto, label }) => {
    const l = porConcepto.get(concepto);
    return fila(
      concepto,
      label,
      parseAmount(l?.budget),
      parseAmount(l?.actual),
      l
        ? { variance: parseAmount(l.variance), variancePct: parseAmountOrNull(l.variance_pct) }
        : undefined,
    );
  });
  return {
    periodoLabel,
    tieneBudget: resp.has_budget,
    filas,
    resultado: filas.find((f) => f.concepto === "result") ?? null,
  };
}

/** Anual (acumulado): suma plan y real por concepto sobre varios meses; deriva la variación de los
 *  TOTALES ya sumados (el backend no expone `budget-vs-actual` de rango — ver cabecera del módulo). */
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
