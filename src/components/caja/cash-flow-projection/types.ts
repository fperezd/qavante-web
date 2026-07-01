/* Tipos de la Proyección de Caja v2 (prototipo de propuesta UX).
 * Presentacional: alimentado por props. Los buckets son los del reporte de
 * cash-flow que el backend ya entrega; el saldo inicial es CashToday.total y la
 * caja mínima viene de /api/treasury/cash-minimum (GET existente). */

import type { ProjBucket } from "./projection-format";

export interface CashFlowProjectionData {
  /** Saldo de caja de partida (CashToday.total, string-decimal CLP). */
  initial_balance: string;
  /** Umbral de caja mínima (string-decimal) o null si no está definido. */
  cash_minimum: string | null;
  /** Granularidad de los buckets (para el copy). */
  granularity: "day" | "week" | "month";
  buckets: ProjBucket[];
}
