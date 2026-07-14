/* Totales del Libro (Ventas/Compras) con neteo de Notas de Crédito. PURO/testeable.
 *
 * Las NC (tipo 60/61/112) RESTAN del total; el resto (facturas, boletas, notas de
 * DÉBITO 56/111) suma. Robusto al signo: normaliza por MAGNITUD (Math.abs) antes
 * de aplicar el signo, así funciona venga la NC positiva o negativa del SII (el
 * detalle RCV usa ambas convenciones según el origen).
 *
 * DECISIÓN Opción A (Fernando, 2026-07-03): se restan TODAS las NC fiel al SII,
 * aunque para una factura puntual las NC superen su monto (sobre-crédito, p.ej.
 * varias NC apuntando al mismo folio). NO filtrar el excedente acá: el F29 (dato
 * oficial) descuenta esas NC igual, así que filtrarlas descuadraría con el F29.
 * La anomalía se marca "revisar" en la fila (ver rcv-anuladas.ts), no se "corrige"
 * la plata (§17.4: el FE no calcula finanzas). */

import { isNotaCredito } from "./tipo-doc";

export interface RcvDocLike {
  tipo_doc?: number;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
  /** Monto exento (exportaciones/ventas exentas). El slim del backend puede no
   *  mandarlo aún → se trata como 0 (ver STATE_OF_THE_TRAIN 2026-07-14). */
  monto_exento?: number;
}

export interface RcvTotals {
  /** Neto AFECTO neteado (NC restadas). */
  neto: number;
  /** Monto EXENTO neteado (exportaciones/exentas). 0 si el backend no lo manda. */
  exento: number;
  iva: number;
  total: number;
  /** Total bruto (sin NC). */
  grossTotal: number;
  /** Monto total de las NC (magnitud). */
  ncTotal: number;
  ncCount: number;
}

function mag(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.abs(v) : 0;
}

export function computeRcvTotals(docs: RcvDocLike[]): RcvTotals {
  let neto = 0, exento = 0, iva = 0, total = 0, grossTotal = 0, ncTotal = 0, ncCount = 0;
  for (const d of docs) {
    const nc = isNotaCredito(d.tipo_doc);
    const sign = nc ? -1 : 1;
    neto += sign * mag(d.monto_neto);
    exento += sign * mag(d.monto_exento);
    iva += sign * mag(d.monto_iva);
    total += sign * mag(d.monto_total);
    if (nc) {
      ncTotal += mag(d.monto_total);
      ncCount += 1;
    } else {
      grossTotal += mag(d.monto_total);
    }
  }
  return { neto, exento, iva, total, grossTotal, ncTotal, ncCount };
}
