/* Tipos de Pagar v2 (prototipo de propuesta UX). Casi todo se deriva FE-only del
 * contrato `accounts-payable` existente (items con due_date, amount, criticidad).
 * El delta de caja usa CashGap (projected_cash_14d / critical_obligations_14d). */

import type { PagoItem } from "./pagar-v2-format";

export interface PagarV2Data {
  total: string;
  /** Caja proyectada a 14 días (de CashGap). */
  projected_cash_14d: string;
  /** Obligaciones críticas a 14 días (de CashGap). */
  critical_obligations_14d: string;
  items: PagoItem[];
}

export type { PagoItem };
