/* Tipos del Cockpit de Caja (prototipo de propuesta UX — control de gestión).
 *
 * Reusa los contratos de caja que el backend YA expone (CashToday, CashForecast,
 * CashGap — hoy agrupados en DashboardSummaryResponse) pero que la pantalla
 * `/caja` no consume. El saldo por cuenta viene de `/api/treasury/bank-accounts`.
 *
 * Presentacional: alimentado por props (Storybook). Cuando se cablee, un wrapper
 * client compone estos datos de los hooks reales. Los tipos de caja son los
 * generados; `BankAccountLine` es provisional hasta confirmar el shape real. */

export interface CashTodayLike {
  /** Saldo total consolidado (string-decimal CLP). */
  total: string;
  /** Última actualización (ISO date-time). */
  last_updated: string;
  data_state: "available" | "stale" | "estimated";
}

export interface CashForecastLike {
  /** Mínimo proyectado a 14 días (string-decimal). */
  min_14d: string;
  /** Mínimo proyectado a 30 días. */
  min_30d: string;
  /** Días de caja (runway) al ritmo actual. */
  days_of_cash: number | null;
}

export interface CashGapLike {
  /** Obligaciones críticas a 14 días (string-decimal). */
  critical_obligations_14d: string;
  /** Caja proyectada a 14 días. */
  projected_cash_14d: string;
  /** ¿La caja proyectada NO cubre las obligaciones críticas? */
  has_gap: boolean;
}

/** Una cuenta/banco con su saldo (provisional — de /api/treasury/bank-accounts). */
export interface BankAccountLine {
  name: string;
  /** "checking" | "savings" | "card" u otro; se muestra legible. */
  kind: string;
  currency_code: string;
  balance: string;
}

export interface CajaCockpitData {
  cash_today: CashTodayLike | null;
  forecast: CashForecastLike | null;
  gap: CashGapLike | null;
  /** Umbral de caja mínima en CLP (string-decimal) o null si no está definido. */
  cash_minimum: string | null;
  accounts: BankAccountLine[];
}
