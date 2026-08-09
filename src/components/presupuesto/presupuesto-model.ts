/* Modelo PURO de la pantalla Presupuesto (ADR-0091, Fase 1a). Sin React → testeable. Deriva el HERO
   ("¿cómo vas?") desde el plan/real por línea de P&L, reusando `mapPlanReal`/`agregarPlanReal` de Plan vs
   Real (mismos montos SIGNADOS: revenue +, costos/gastos −, result = suma). El semáforo mide la desviación
   del RESULTADO vs el plan. Contrato en qavante-web#883. */

import type { PlanReal, PlanRealConcepto } from "@/components/inicio/v2/plan-real-model";

export type Semaforo = "good" | "warn" | "bad";

export interface PresupuestoHero {
  periodoLabel: string;
  /** Resultado real del período (con signo). */
  resultadoReal: number;
  /** Resultado presupuestado. */
  resultadoPlan: number;
  /** real − plan (con signo): + = vas arriba del plan, − = abajo. */
  variacion: number;
  /** |variacion| / |plan| * 100; `null` si no hay plan. */
  variacionPct: number | null;
  semaforo: Semaforo;
  /** Ventas reales del período (para la barra de referencia). */
  ventas: number;
  /** Costos + gastos reales (magnitud). */
  gastoReal: number;
  /** Costos + gastos presupuestados (magnitud). */
  gastoPlan: number;
  /** `true` si el gasto real supera el presupuestado. */
  gastoOver: boolean;
}

/** Semáforo por desviación del resultado: favorable (≥ plan) siempre verde; si va abajo, por magnitud:
 *  ≤5% verde, 5–15% amarillo, >15% rojo (umbrales de la spec ADR-0091). `null` (sin plan) → verde. */
export function semaforoResultado(variacion: number, variacionPct: number | null): Semaforo {
  if (variacion >= 0) return "good";
  const abs = variacionPct != null ? Math.abs(variacionPct) : 0;
  if (abs <= 5) return "good";
  if (abs <= 15) return "warn";
  return "bad";
}

export interface DesvioLinea {
  concepto: PlanRealConcepto;
  label: string;
  /** Presupuestado y realizado, ambos con signo (revenue +, costos/gastos −). */
  plan: number;
  real: number;
  /** real − plan con signo: + = a favor, − = en contra (gracias al signado uniforme). */
  variacion: number;
  variacionPct: number | null;
  favorable: boolean;
}

/** Desvíos por línea de P&L (Ingresos / Costo directo / Gastos), SIN el Resultado (que es el total del
 *  hero). Orden: primero lo que juega EN CONTRA (por magnitud), después lo a favor. Las líneas sin desvío
 *  se omiten (no aportan). Alimenta el bloque "Lo que se desvía" — desglose por CONCEPTO, no por cuenta
 *  (ese, marketing/sueldos/software, espera el presupuesto a nivel de cuenta del backend). */
export function desviosPresupuesto(pr: PlanReal): DesvioLinea[] {
  return pr.filas
    .filter((f) => f.concepto !== "result" && f.variacion !== 0)
    .map((f) => ({
      concepto: f.concepto,
      label: f.label,
      plan: f.plan,
      real: f.real,
      variacion: f.variacion,
      variacionPct: f.variacionPct,
      favorable: f.favorable,
    }))
    .sort((a, b) =>
      a.favorable !== b.favorable
        ? a.favorable
          ? 1
          : -1
        : Math.abs(b.variacion) - Math.abs(a.variacion),
    );
}

/** Deriva el hero desde el PlanReal (ya mapeado de budget-vs-actual). `null` si no hay fila de resultado. */
export function heroPresupuesto(pr: PlanReal): PresupuestoHero | null {
  const byId = new Map(pr.filas.map((f) => [f.concepto, f]));
  const result = byId.get("result");
  if (!result) return null;
  const revenue = byId.get("revenue");
  const dc = byId.get("direct_cost");
  const oe = byId.get("operating_expense");

  const gastoReal = Math.abs(dc?.real ?? 0) + Math.abs(oe?.real ?? 0);
  const gastoPlan = Math.abs(dc?.plan ?? 0) + Math.abs(oe?.plan ?? 0);

  return {
    periodoLabel: pr.periodoLabel,
    resultadoReal: result.real,
    resultadoPlan: result.plan,
    variacion: result.variacion,
    variacionPct: result.variacionPct,
    semaforo: semaforoResultado(result.variacion, result.variacionPct),
    ventas: Math.abs(revenue?.real ?? 0),
    gastoReal,
    gastoPlan,
    gastoOver: gastoReal > gastoPlan,
  };
}
