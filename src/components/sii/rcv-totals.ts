/* Totales del Libro (Ventas/Compras) con neteo de Notas de Crédito. PURO/testeable.
 *
 * Las NC (tipo 60/61/112) RESTAN del total; el resto (facturas, boletas, notas de
 * DÉBITO 56/111) suma. Robusto al signo: normaliza por MAGNITUD (Math.abs) antes
 * de aplicar el signo, así funciona venga la NC positiva o negativa del SII (el
 * detalle RCV usa ambas convenciones según el origen). */

import { isNotaCredito } from "./tipo-doc";

export interface RcvDocLike {
  tipo_doc?: number;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
}

export interface RcvTotals {
  /** Neto neteado (NC restadas). */
  neto: number;
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
  let neto = 0, iva = 0, total = 0, grossTotal = 0, ncTotal = 0, ncCount = 0;
  for (const d of docs) {
    const nc = isNotaCredito(d.tipo_doc);
    const sign = nc ? -1 : 1;
    neto += sign * mag(d.monto_neto);
    iva += sign * mag(d.monto_iva);
    total += sign * mag(d.monto_total);
    if (nc) {
      ncTotal += mag(d.monto_total);
      ncCount += 1;
    } else {
      grossTotal += mag(d.monto_total);
    }
  }
  return { neto, iva, total, grossTotal, ncTotal, ncCount };
}
