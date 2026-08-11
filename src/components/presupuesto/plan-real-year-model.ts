/* Modelo PURO del "Plan vs Real por cuenta-mes" del Presupuesto. Sin React → testeable. Pivotea las N
   respuestas mensuales de `budget-by-account` (una por mes cerrado del año) a una grilla cuentas × meses,
   con el REAL y la VARIACIÓN (actual − budget, SIGNADA: + = a favor, − = en contra) por celda. */

import type { BudgetByAccountResponse } from "@/lib/api/planning";

export interface PlanRealCelda {
  /** Real del mes (actual, signado: ingreso +, costo/gasto −). */
  real: number;
  /** actual − budget (signado): + = a favor, − = en contra. */
  variacion: number;
}

export interface PlanRealFila {
  accountId: string | null;
  code: string | null;
  name: string;
  /** Una celda por mes (índice = posición del mes en el rango). `null` = sin dato ese mes. */
  meses: (PlanRealCelda | null)[];
  /** Suma anual del real (signado) y de la variación (signado). */
  totalReal: number;
  totalVariacion: number;
}

export interface PlanRealYear {
  filas: PlanRealFila[];
  /** Totales por mes (real y variación signados). */
  totalRealMes: number[];
  totalVariacionMes: number[];
  totalRealAnio: number;
  totalVariacionAnio: number;
  /** Cuántos meses del rango ya trajeron dato (para "cargando N/M"). */
  mesesConDato: number;
}

function n(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Pivotea las respuestas mensuales (en orden de mes) a la grilla cuentas × meses. */
export function buildPlanRealYear(resps: (BudgetByAccountResponse | undefined)[]): PlanRealYear {
  const nMeses = resps.length;
  const clave = (a: { account_id?: string | null; account_name: string }) =>
    a.account_id ?? `name:${a.account_name}`;
  const map = new Map<string, PlanRealFila>();
  const orden: string[] = [];

  resps.forEach((r, m) => {
    (r?.accounts ?? []).forEach((a) => {
      const k = clave(a);
      let fila = map.get(k);
      if (!fila) {
        fila = {
          accountId: a.account_id ?? null,
          code: a.account_code ?? null,
          name: a.account_name,
          meses: Array(nMeses).fill(null),
          totalReal: 0,
          totalVariacion: 0,
        };
        map.set(k, fila);
        orden.push(k);
      }
      const real = n(a.actual);
      const variacion = n(a.variance);
      fila.meses[m] = { real, variacion };
      fila.totalReal += real;
      fila.totalVariacion += variacion;
    });
  });

  const filas = orden.map((k) => map.get(k)!);
  const totalRealMes = Array.from({ length: nMeses }, (_, m) =>
    filas.reduce((s, f) => s + (f.meses[m]?.real ?? 0), 0),
  );
  const totalVariacionMes = Array.from({ length: nMeses }, (_, m) =>
    filas.reduce((s, f) => s + (f.meses[m]?.variacion ?? 0), 0),
  );

  return {
    filas,
    totalRealMes,
    totalVariacionMes,
    totalRealAnio: filas.reduce((s, f) => s + f.totalReal, 0),
    totalVariacionAnio: filas.reduce((s, f) => s + f.totalVariacion, 0),
    mesesConDato: resps.filter((r) => r?.has_budget).length,
  };
}
