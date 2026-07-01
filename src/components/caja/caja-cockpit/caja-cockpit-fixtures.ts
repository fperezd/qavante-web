/* Datos de ejemplo del Cockpit de Caja (Storybook / validación de UX).
 * No se usan en producción. */

import type { CajaCockpitData } from "./types";

/** Caja sana: runway holgado, sin quiebre. */
export const cajaSana: CajaCockpitData = {
  cash_today: { total: "48250000", last_updated: "2026-07-01T09:12:00Z", data_state: "available" },
  forecast: { min_14d: "31200000", min_30d: "18400000", days_of_cash: 62 },
  gap: { critical_obligations_14d: "12800000", projected_cash_14d: "31200000", has_gap: false },
  cash_minimum: "10000000",
  accounts: [
    { name: "Banco BICE · Cuenta corriente", kind: "checking", currency_code: "CLP", balance: "42100000" },
    { name: "Banco BICE · Cuenta USD", kind: "checking", currency_code: "USD", balance: "6400" },
    { name: "Tarjeta empresa", kind: "card", currency_code: "CLP", balance: "-1350000" },
  ],
};

/** Quiebre de caja: obligaciones críticas > caja proyectada, runway corto. */
export const cajaEnRiesgo: CajaCockpitData = {
  cash_today: { total: "9800000", last_updated: "2026-07-01T09:12:00Z", data_state: "available" },
  forecast: { min_14d: "4200000", min_30d: "-1800000", days_of_cash: 11 },
  gap: { critical_obligations_14d: "7300000", projected_cash_14d: "4200000", has_gap: true },
  cash_minimum: "5000000",
  accounts: [
    { name: "Banco BICE · Cuenta corriente", kind: "checking", currency_code: "CLP", balance: "9800000" },
  ],
};

/** Runway ajustado (amarillo) sin quiebre declarado. */
export const cajaAjustada: CajaCockpitData = {
  cash_today: { total: "21500000", last_updated: "2026-07-01T09:12:00Z", data_state: "available" },
  forecast: { min_14d: "14300000", min_30d: "6100000", days_of_cash: 23 },
  gap: { critical_obligations_14d: "9200000", projected_cash_14d: "14300000", has_gap: false },
  cash_minimum: "8000000",
  accounts: [
    { name: "Banco BICE · Cuenta corriente", kind: "checking", currency_code: "CLP", balance: "21500000" },
  ],
};

/** Datos desactualizados / parciales: el cockpit degrada honesto. */
export const cajaDesactualizada: CajaCockpitData = {
  cash_today: { total: "15000000", last_updated: "2026-06-24T18:40:00Z", data_state: "stale" },
  forecast: { min_14d: "9000000", min_30d: "4000000", days_of_cash: null },
  gap: null,
  cash_minimum: null,
  accounts: [
    { name: "Banco BICE · Cuenta corriente", kind: "checking", currency_code: "CLP", balance: "15000000" },
  ],
};
