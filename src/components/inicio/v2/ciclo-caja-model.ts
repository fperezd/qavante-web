/* Modelo PURO del widget "Ciclo de caja" del Inicio (sin React → testeable). Responde, en lenguaje de
   dueño: ¿en cuántos días cobro?, ¿en cuántos pago?, ¿cuántos días queda mi plata atrapada?
   Fuente: /api/treasury/cash-cycle (DSO/DPO/CCC ya calculados por el backend — NO recalculamos). */

import type { CashCycleResponse } from "@/lib/api/treasury";

export interface CicloCaja {
  /** Días que tardo en COBRAR (DSO); `null` si no hay dato. */
  dso: number | null;
  /** Días que tardo en PAGAR (DPO); `null` si no hay dato. */
  dpo: number | null;
  /** Ciclo de conversión de caja = DSO − DPO; `null` si no hay dato. */
  ccc: number | null;
}

/** Deriva el ciclo de caja del `cash-cycle`. `null` si no vino ningún día (el contenedor degrada). */
export function mapCicloCaja(resp: CashCycleResponse | undefined): CicloCaja | null {
  if (!resp) return null;
  if (resp.dso_days == null && resp.dpo_days == null && resp.ccc_days == null) return null;
  return { dso: resp.dso_days, dpo: resp.dpo_days, ccc: resp.ccc_days };
}
