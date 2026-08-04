/* Línea de crédito (LC) de una cuenta BICE, derivada del `BalanceData` del balance por cuenta.
 * Pedido de Fernando 2026-08-02: "en Caja falta visualizar la línea de crédito del banco… debe indicar
 * cuánto queda". El campo estrella es `montoDisponible` (lo que queda de la LC). PURO/testeable. */

import { parseSaldo } from "./bank-balances-format";
import type { BalanceData } from "@/lib/api/treasury";

export interface LineaCredito {
  /** Cupo aprobado de la LC (`montoAprobadoMonto`). */
  cupo: number;
  /** Monto usado de la LC (`montoUtilizadoMonto`). */
  usado: number;
  /** Monto disponible de la LC (`montoDisponibleMonto`) — "cuánto queda". */
  disponible: number;
  moneda: string | null;
  /** Vencimiento del sobregiro (ISO), si la cuenta lo informa. */
  vencimientoSobregiro: string | null;
}

/** Extrae la LC de un `BalanceData`. `null` si la cuenta NO tiene línea (cupo aprobado nulo o ≤0):
 *  "sin línea de crédito" no es lo mismo que "línea de $0", y no toda cuenta tiene una. */
export function lineaCreditoDe(balance: BalanceData | null | undefined): LineaCredito | null {
  if (!balance) return null;
  const cupo = parseSaldo(balance.montoAprobadoMonto);
  if (cupo == null || cupo <= 0) return null;
  const usado = parseSaldo(balance.montoUtilizadoMonto) ?? 0;
  // Preferimos el disponible que informa el banco; si no viene, lo derivamos (cupo − usado, sin negativo).
  const disponible = parseSaldo(balance.montoDisponibleMonto) ?? Math.max(cupo - usado, 0);
  return {
    cupo,
    usado,
    disponible,
    moneda: balance.montoAprobadoCodigoMoneda ?? balance.montoDisponibleCodigoMoneda ?? null,
    vencimientoSobregiro: balance.fechaVencimientoSobregiro ?? null,
  };
}
