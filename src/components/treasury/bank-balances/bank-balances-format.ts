/* Formateo de saldos de banco (BICE). El backend entrega los saldos como STRING
 * numérico ("1931152.70") y la moneda como "CLP"/"USD". PURO/testeable. */

import { formatMoney } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";

/** Parsea el saldo-string del backend a número; `null` si no es un número válido.
 *  Trim previo: un string en blanco NO es "$0", es "sin dato" (`Number(" ")` da 0).
 *  Alias del parser central: la semántica "preserva el no-se-sabe" es la misma. */
export const parseSaldo = parseAmountOrNull;

/** Formatea un saldo según su moneda (reusa `formatMoney`: CLP sin decimales,
 *  USD con dos). Sin dato → guion. */
export function formatSaldo(
  value: string | null | undefined,
  moneda: string | null | undefined,
): string {
  const n = parseSaldo(value);
  if (n == null) return "Sin información";
  return formatMoney(n, moneda);
}
