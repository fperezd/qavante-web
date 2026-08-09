/* Modelo PURO de la grilla anual editable del Presupuesto (CC-API F2, GET /budget/{year}). Sin React →
   testeable. Agrupa las cuentas por sección de P&L (Ingresos / Costos directos / Gastos operacionales),
   calcula subtotales por mes y el Resultado (suma signada de todas las secciones). Montos SIGNADOS
   (ingreso +, costo/gasto −); la vista muestra magnitudes bajo cada sección. */

import type { BudgetGridResponse, BudgetGridCategory } from "@/lib/api/planning";

export const MESES_GRID = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

/** Secciones del P&L en orden, con su signo canónico. `revenue` suma; costos/gastos restan. */
export const SECCIONES_GRID: { impact: string; label: string; signo: 1 | -1 }[] = [
  { impact: "revenue", label: "Ingresos", signo: 1 },
  { impact: "direct_cost", label: "Costos directos", signo: -1 },
  { impact: "operating_expense", label: "Gastos operacionales", signo: -1 },
];

export interface GridFila {
  accountId: string | null;
  code: string | null;
  name: string;
  impact: string;
  /** 12 montos signados (índice 0 = enero). */
  meses: number[];
  totalAnio: number;
}

export interface GridSeccion {
  impact: string;
  label: string;
  signo: 1 | -1;
  filas: GridFila[];
  /** Subtotal signado por mes (12). */
  subtotalMeses: number[];
  totalAnio: number;
}

export interface BudgetGridModel {
  year: number;
  currency: string;
  status: string | null;
  accepted: boolean;
  secciones: GridSeccion[];
  /** Resultado = suma signada de todas las secciones, por mes (12). */
  resultadoMeses: number[];
  resultadoAnio: number;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** `months` del backend es `{ "1".."12": monto signado }` → array de 12 (falta = 0). */
function mesesDe(cat: BudgetGridCategory): number[] {
  return Array.from({ length: 12 }, (_, i) => n(cat.months?.[String(i + 1)]));
}

function sumar(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + (b[i] ?? 0));
}

/** Deriva la grilla agrupada + subtotales + resultado desde la respuesta del backend. */
export function buildBudgetGrid(resp: BudgetGridResponse): BudgetGridModel {
  const cats = resp.categories ?? [];
  const secciones: GridSeccion[] = SECCIONES_GRID.map(({ impact, label, signo }) => {
    const filas: GridFila[] = cats
      .filter((c) => c.impact_type === impact)
      .map((c) => {
        const meses = mesesDe(c);
        return {
          accountId: c.account_id ?? null,
          code: c.account_code ?? null,
          name: c.account_name,
          impact,
          meses,
          totalAnio: meses.reduce((s, x) => s + x, 0),
        };
      });
    const subtotalMeses = filas.reduce<number[]>(
      (acc, f) => sumar(acc, f.meses),
      Array(12).fill(0),
    );
    return {
      impact,
      label,
      signo,
      filas,
      subtotalMeses,
      totalAnio: subtotalMeses.reduce((s, x) => s + x, 0),
    };
  });

  const resultadoMeses = secciones.reduce<number[]>(
    (acc, s) => sumar(acc, s.subtotalMeses),
    Array(12).fill(0),
  );

  return {
    year: resp.year,
    currency: resp.currency,
    status: resp.status ?? null,
    accepted: resp.accepted,
    secciones,
    resultadoMeses,
    resultadoAnio: resultadoMeses.reduce((s, x) => s + x, 0),
  };
}
