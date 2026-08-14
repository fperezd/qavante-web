/* Totales multi-moneda HONESTOS para las listas de movimientos de Caja.
 *
 * Invariante INV-FX-001: no se suman montos de monedas distintas sin conversión
 * explícita. Como el frontend NO tiene tipo de cambio cableado en estas pantallas,
 * la única salida honesta es NO totalizar: se muestra un total por moneda, o se
 * declara que no se puede totalizar. Nunca un total mezclado, nunca un cero
 * inventado, nunca "asumamos CLP".
 *
 * Brecha de contrato (verificada contra `docs/contracts/openapi.snapshot.json`):
 * `BankMovement` NO expone moneda — sus campos son id, bank_account_id,
 * external_id, date, description, amount, direction, … y ninguno es
 * `currency`/`currency_code`. La moneda vive SOLO en `BankAccountItem.currency_code`.
 * Por eso la moneda de un movimiento se deriva por `bank_account_id` → cuenta.
 * Si esa cuenta no está en la lista de cuentas (p.ej. cuenta desactivada: el
 * endpoint devuelve `active=true` por defecto), la moneda es DESCONOCIDA y el
 * movimiento no entra en ningún total: se cuenta aparte y se declara.
 *
 * Módulo PURO (sin React, sin fetch) → unit-testeable.
 */

import type { BankAccountItem, BankMovement } from "@/lib/api/treasury";
import { formatMoney } from "@/lib/formatters/clp";

/** Total de UNA moneda. Montos siempre en MAGNITUD (los débitos llegan con monto
 *  negativo del banco; el neto se arma como ingresos − egresos). */
export interface CurrencyTotal {
  /** ISO-4217 de la cuenta (ej. "CLP", "USD"). */
  currency: string;
  /** Suma de magnitudes de los movimientos `credit`. */
  credit: number;
  /** Suma de magnitudes de los movimientos `debit`. */
  debit: number;
  /** `credit − debit`, en esta moneda y solo en esta moneda. */
  net: number;
  count: number;
}

export interface MultiCurrencyTotals {
  /** Un total por moneda, ordenado por cantidad de movimientos (desc) y luego
   *  por código (asc) para que el orden sea estable. */
  totals: CurrencyTotal[];
  /** Movimientos cuya moneda NO se pudo determinar (cuenta ausente del mapa).
   *  No entran en ningún total: sumarlos sería inventar la moneda. */
  unknownCount: number;
  /** Total de movimientos considerados (incluye los de moneda desconocida). */
  count: number;
  /** ¿Se puede mostrar UN solo total? Solo con exactamente una moneda conocida
   *  y ningún movimiento de moneda desconocida. */
  totalizable: boolean;
  /** La moneda única cuando `totalizable`; `null` si no se puede totalizar.
   *  NUNCA cae a "CLP" por defecto. */
  currency: string | null;
}

/** Mapa `bank_account_id → currency_code`. Puro. */
export function currencyByAccount(accounts: BankAccountItem[]): Map<string, string> {
  return new Map(accounts.map((a) => [a.id, a.currency_code]));
}

/** Magnitud del monto de un movimiento. `amount` viaja como string decimal en el
 *  contrato; no parseable ⇒ 0 (no rompe la suma; el movimiento igual se cuenta). */
function magnitude(m: BankMovement): number {
  const n = Number(m.amount);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Arma los totales por moneda de un set de movimientos.
 *
 * `currencies` es el mapa `bank_account_id → currency_code` (de `currencyByAccount`).
 * Un movimiento cuya cuenta no está en el mapa cae en `unknownCount`: NO se suma
 * a ninguna moneda. */
export function buildMultiCurrencyTotals(
  items: BankMovement[],
  currencies: Map<string, string>,
): MultiCurrencyTotals {
  const buckets = new Map<string, CurrencyTotal>();
  let unknownCount = 0;

  for (const m of items) {
    const currency = currencies.get(m.bank_account_id);
    if (!currency) {
      unknownCount += 1;
      continue;
    }
    const bucket = buckets.get(currency) ?? {
      currency,
      credit: 0,
      debit: 0,
      net: 0,
      count: 0,
    };
    const amount = magnitude(m);
    if (m.direction === "credit") bucket.credit += amount;
    else if (m.direction === "debit") bucket.debit += amount;
    bucket.net = bucket.credit - bucket.debit;
    bucket.count += 1;
    buckets.set(currency, bucket);
  }

  const totals = [...buckets.values()].sort(
    (a, b) => b.count - a.count || a.currency.localeCompare(b.currency),
  );
  const only = totals.length === 1 ? totals[0] : undefined;
  const totalizable = only != null && unknownCount === 0;

  return {
    totals,
    unknownCount,
    count: items.length,
    totalizable,
    currency: totalizable ? only.currency : null,
  };
}

/** Formatea el monto de UN movimiento en la moneda de su cuenta.
 *
 * Si la moneda no se conoce (la cuenta no está en el mapa) NO cae a CLP:
 * `formatMoney(x, undefined)` rinde "$1.234", que es afirmar una moneda que no
 * sabemos. Devuelve el número sin símbolo y marcado como moneda sin dato — una
 * fila honesta vale más que una fila linda y falsa. */
export function formatMovementAmount(value: number, currency: string | undefined | null): string {
  if (currency) return formatMoney(value, currency);
  if (!Number.isFinite(value)) return "s/d";
  const n = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value);
  return `${n} · moneda s/d`;
}

/** ¿Hay más de una moneda entre las cuentas del tenant? */
export function hasMixedCurrencies(accounts: BankAccountItem[]): boolean {
  return new Set(accounts.map((a) => a.currency_code)).size > 1;
}

/** Códigos de moneda distintos entre las cuentas, ordenados. Para rotular el
 *  selector ("CLP · USD") sin repetir. */
export function currencyCodes(accounts: BankAccountItem[]): string[] {
  return [...new Set(accounts.map((a) => a.currency_code))].sort((a, b) => a.localeCompare(b));
}

/** Frase corta que explica por qué NO se totaliza. `null` si sí se puede.
 *  Se usa como sublabel/aviso — el usuario tiene que entender que no es un bug. */
export function noTotalReason(totals: MultiCurrencyTotals): string | null {
  if (totals.totalizable) return null;
  /* Orden alfabético para que la frase sea estable ("CLP y USD" siempre), aunque
     los buckets vengan ordenados por cantidad de movimientos. */
  const codes = totals.totals.map((t) => t.currency).sort((a, b) => a.localeCompare(b));
  if (codes.length > 1 && totals.unknownCount > 0) {
    return `Hay ${codes.join(" y ")} y ${totals.unknownCount} ${
      totals.unknownCount === 1 ? "movimiento" : "movimientos"
    } sin moneda conocida. No sumamos monedas distintas sin tipo de cambio.`;
  }
  if (codes.length > 1) {
    return `Hay movimientos en ${codes.join(" y ")}. No sumamos monedas distintas sin tipo de cambio: mira el total de cada una o elige una cuenta.`;
  }
  if (totals.unknownCount > 0) {
    return `No conocemos la moneda de ${totals.unknownCount} ${
      totals.unknownCount === 1 ? "movimiento" : "movimientos"
    } (su cuenta no está en tu lista de cuentas activas). Los dejamos fuera del total.`;
  }
  return "No hay movimientos con moneda conocida para totalizar.";
}
