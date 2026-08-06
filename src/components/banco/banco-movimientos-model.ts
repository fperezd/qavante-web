/* Modelo PURO del detalle de movimientos de Banco (#detalle). Sin React → testeable.
   - CUENTA: los movimientos salen de `/api/bank-movements` (stored, rápido, filtrable por mes). El
     `SaldoResponse` de bice da el `numeroFormateado` de la cuenta; `bice/accounts` lo mapea a su
     `linked_bank_account_id`, con el que filtramos los movimientos. (No usamos la cartola live: lenta.)
   - TARJETA: `/api/bice/tarjetas/{op}/movimientos` devuelve una ventana; filtramos por mes en el FE. */

import { parseAmount } from "@/components/gestion/gestion-format";
import type { BankMovement, TarjetaMovimiento } from "@/lib/api/treasury";

/** Un movimiento normalizado para la lista del detalle. `monto` FIRMADO (negativo = egreso). */
export interface MovimientoBanco {
  fecha: string;
  glosa: string;
  monto: number;
  moneda: string;
  /** Extra de tarjeta: cuotas ("03/06"), si aplica. */
  cuotas?: string | null;
}

interface BiceAccountLike {
  external_id?: string | null;
  linked_bank_account_id?: string | null;
}

/** El `bank_account_id` (Qavante) de una cuenta bice, por su `numeroFormateado` (= `external_id` en
 *  `bice/accounts`). `null` si no está vinculada / no matchea. */
export function bankAccountIdDeCuenta(
  biceAccounts: BiceAccountLike[] | undefined,
  numeroFormateado: string | null | undefined,
): string | null {
  if (!numeroFormateado) return null;
  const hit = (biceAccounts ?? []).find((a) => a.external_id === numeroFormateado);
  return hit?.linked_bank_account_id ?? null;
}

/** Movimientos de una cuenta: los de `/api/bank-movements` cuyo `bank_account_id` calza. Firmados
 *  (egreso negativo), ordenados por fecha desc (regla de grillas). */
export function movimientosDeCuenta(
  items: BankMovement[],
  bankAccountId: string | null,
  moneda: string,
): MovimientoBanco[] {
  if (!bankAccountId) return [];
  return items
    .filter((m) => m.bank_account_id === bankAccountId)
    .map((m) => ({
      fecha: m.date,
      glosa: m.description ?? "—",
      monto: montoFirmado(m),
      moneda,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Monto firmado del movimiento de banco: el signo del `amount` si lo trae; si el `amount` viene en
 *  valor absoluto, lo firma por `direction` (débito = egreso = negativo). */
function montoFirmado(m: BankMovement): number {
  const raw = parseAmount(m.amount);
  if (raw < 0) return raw;
  const dir = (m.direction ?? "").toLowerCase();
  const esEgreso = dir.includes("deb") || dir.includes("egres") || dir === "out";
  return esEgreso ? -raw : raw;
}

/** "YYYY-MM" de una fecha en formatos comunes: ISO "YYYY-MM-DD…", "DD/MM/YYYY", "DD-MM-YYYY".
 *  `null` si no se puede inferir (no filtramos a ciegas). */
export function mesDeFecha(date: string | null | undefined): string | null {
  if (!date) return null;
  const iso = /^(\d{4})-(\d{2})/.exec(date);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const dmy = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(date);
  if (dmy) return `${dmy[3]}-${dmy[2]}`;
  return null;
}

/** Movimientos de una tarjeta filtrados por mes ("YYYY-MM"). Si la fecha no se puede parsear, el
 *  movimiento se INCLUYE (mejor mostrarlo que ocultarlo por un formato raro). Ordena por fecha desc. */
export function movimientosDeTarjeta(
  movs: TarjetaMovimiento[] | undefined,
  period: string,
): MovimientoBanco[] {
  return (movs ?? [])
    .filter((m) => {
      const mes = mesDeFecha(m.date);
      return mes === null || mes === period;
    })
    .map((m) => ({
      fecha: m.date ?? "",
      glosa: m.description ?? "—",
      // `amount` de tarjeta llega como number (a diferencia del string de bank-movements).
      monto: typeof m.amount === "number" ? m.amount : parseAmount(m.amount ?? ""),
      moneda: (m.currency ?? "CLP").toUpperCase(),
      cuotas: m.installmentsDescription ?? null,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
