/* Datos de ejemplo de la Proyección de Caja v2 (Storybook). No prod. */

import type { CashFlowProjectionData } from "./types";

const wk = (label: string, inflow: string, outflow: string): { period: string; label: string; inflow: string; outflow: string; net: string } => ({
  period: "2026-07-01",
  label,
  inflow,
  outflow,
  net: String(Number(inflow) - Number(outflow)),
});

/** Proyección sana: la caja baja y se recupera, nunca cruza el mínimo. */
export const proyeccionSana: CashFlowProjectionData = {
  initial_balance: "28000000",
  cash_minimum: "8000000",
  granularity: "week",
  buckets: [
    wk("07 jul", "6200000", "9800000"),
    wk("14 jul", "11500000", "7300000"),
    wk("21 jul", "4800000", "12100000"),
    wk("28 jul", "14200000", "6900000"),
    wk("04 ago", "7300000", "9200000"),
    wk("11 ago", "13800000", "8100000"),
  ],
};

/** Proyección con QUIEBRE: cae bajo la caja mínima en la semana del 21. */
export const proyeccionConQuiebre: CashFlowProjectionData = {
  initial_balance: "16000000",
  cash_minimum: "6000000",
  granularity: "week",
  buckets: [
    wk("07 jul", "5200000", "8800000"),
    wk("14 jul", "3100000", "7300000"),
    wk("21 jul", "2800000", "9100000"),
    wk("28 jul", "9200000", "5400000"),
    wk("04 ago", "6300000", "7200000"),
    wk("11 ago", "12800000", "6100000"),
  ],
};

/** Sin caja mínima definida: muestra la curva pero sin línea de umbral ni quiebre. */
export const proyeccionSinMinimo: CashFlowProjectionData = {
  initial_balance: "20000000",
  cash_minimum: null,
  granularity: "week",
  buckets: [
    wk("07 jul", "6200000", "9800000"),
    wk("14 jul", "5500000", "7300000"),
    wk("21 jul", "4800000", "12100000"),
    wk("28 jul", "9200000", "6900000"),
  ],
};
