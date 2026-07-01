/* Tipos del Inicio Ejecutivo v2 (prototipo). Los campos nuevos (key_obligations,
 * cash_sparkline, cash_delta_pct) YA existen en DashboardSummaryV2 (dashboard.ts,
 * gated `dashboardV2`) pero la vista actual no los renderiza. `ventas_delta_yoy`
 * requiere ampliar el summary. */

import type { Coverage } from "./inicio-v2-format";

export interface KeyObligationLite {
  key: string;
  label: string;
  /** ISO date. */
  due_date: string;
  amount: string;
  coverage: Coverage;
}

export interface InicioV2Data {
  /** Saldo de caja hoy (string-decimal CLP). */
  cash_today: string;
  /** Variación % de la caja vs período anterior. */
  cash_delta_pct: number | null;
  /** Serie de caja (más reciente último) para el sparkline. */
  cash_sparkline: number[];
  /** Runway. */
  days_of_cash: number | null;
  /** Ventas del mes. */
  ventas_mes: string;
  /** Variación vs mismo mes del año anterior. */
  ventas_delta_yoy: number | null;
  /** Hasta 3 fechas clave del mes (imposiciones / F29 / sueldos). */
  key_obligations: KeyObligationLite[];
}
