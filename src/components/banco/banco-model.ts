/* Modelo PURO de la pantalla Banco. El banco agrupa sus PRODUCTOS: cuentas corrientes (saldo + línea
 * de crédito) y tarjetas de crédito (cupo national=CLP / international=USD). Acá va la normalización
 * del cupo de tarjeta; la línea de crédito de la cuenta reusa `lineaCreditoDe`. Sin React, testeable. */

import type { TarjetaSaldoData } from "@/lib/api/treasury";

type CupoMoneda = NonNullable<TarjetaSaldoData["national"]>;

/** Cupo de una tarjeta en UNA moneda (CLP national / USD international). */
export interface CupoTarjeta {
  /** "CLP" | "USD". */
  moneda: string;
  /** Cupo total aprobado. */
  total: number;
  /** Usado (gastado). */
  usado: number;
  /** Disponible (lo que queda). */
  disponible: number;
  /** Facturado del período (o null). */
  facturado: number | null;
  /** Vencimiento del pago (ISO) o null. */
  vencimiento: string | null;
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Un cupo de una moneda → `CupoTarjeta`, o `null` si no trae ningún monto real (no inventamos $0). */
function normalizarCupo(moneda: string, c: CupoMoneda | null | undefined): CupoTarjeta | null {
  if (!c) return null;
  const total = num(c.totalQuota);
  const usado = num(c.spentQuota);
  // Preferimos el disponible que informa el banco; si no viene, lo derivamos (total − usado, sin negativo).
  const disponible =
    num(c.availableQuota) ?? (total != null && usado != null ? Math.max(total - usado, 0) : null);
  if (total == null && usado == null && disponible == null) return null;
  return {
    moneda,
    total: total ?? 0,
    usado: usado ?? 0,
    disponible: disponible ?? 0,
    facturado: num(c.billedAmmount), // (sic) BICE escribe "billedAmmount"
    vencimiento: c.dueDate ?? null,
  };
}

/** Cupos con dato real de una tarjeta: CLP (national) + USD (international), en ese orden. */
export function cuposDeTarjeta(saldo: TarjetaSaldoData | null | undefined): CupoTarjeta[] {
  if (!saldo) return [];
  return [normalizarCupo("CLP", saldo.national), normalizarCupo("USD", saldo.international)].filter(
    (c): c is CupoTarjeta => c !== null,
  );
}
