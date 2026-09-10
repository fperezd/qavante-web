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
  tipo_doc?: number | null;
  /** Bridge canónico API #420. No se reconstruye desde los monto_* históricos. */
  neto_afecto?: number | null;
  exento?: number | null;
  iva?: number | null;
  otros_ajustes_residual?: number | null;
  total?: number | null;
  complete?: boolean;
  missing_components?: string[];
}

export interface RcvBreakdown {
  netoAfecto: number;
  exento: number;
  iva: number;
  otrosAjustes: number;
  total: number;
  netoSinIva: number;
}

export interface RcvTotals {
  /** Aliases de compatibilidad; null significa que no hay cobertura publicable. */
  neto: number | null;
  exento: number | null;
  iva: number | null;
  total: number | null;
  /** Total bruto (sin NC). */
  grossTotal: number | null;
  /** Monto total de las NC (magnitud). */
  ncTotal: number | null;
  ncCount: number;
  /** Null cuando al menos una fila filtrada no tiene desglose canónico completo. */
  breakdown: RcvBreakdown | null;
  incompleteCount: number;
}

export function hasCompleteRcvBreakdown(
  doc: RcvDocLike,
): doc is RcvDocLike & CompleteRcvBreakdownFields {
  return (
    doc.complete === true &&
    typeof doc.neto_afecto === "number" &&
    Number.isFinite(doc.neto_afecto) &&
    typeof doc.exento === "number" &&
    Number.isFinite(doc.exento) &&
    typeof doc.iva === "number" &&
    Number.isFinite(doc.iva) &&
    typeof doc.otros_ajustes_residual === "number" &&
    Number.isFinite(doc.otros_ajustes_residual) &&
    typeof doc.total === "number" &&
    Number.isFinite(doc.total)
  );
}

type CompleteRcvBreakdownFields = {
  neto_afecto: number;
  exento: number;
  iva: number;
  otros_ajustes_residual: number;
  total: number;
};

export function computeRcvTotals(docs: RcvDocLike[]): RcvTotals {
  let netoAfecto = 0,
    bridgeExento = 0,
    bridgeIva = 0,
    otrosAjustes = 0,
    bridgeTotal = 0,
    grossTotal = 0,
    ncTotal = 0,
    ncCount = 0;
  let incompleteCount = 0;
  for (const d of docs) {
    const nc = isNotaCredito(d.tipo_doc);
    const sign = nc ? -1 : 1;
    if (hasCompleteRcvBreakdown(d)) {
      netoAfecto += sign * Math.abs(d.neto_afecto);
      bridgeExento += sign * Math.abs(d.exento);
      bridgeIva += sign * Math.abs(d.iva);
      otrosAjustes += sign * Math.abs(d.otros_ajustes_residual);
      bridgeTotal += sign * Math.abs(d.total);
      if (nc) ncTotal += Math.abs(d.total);
      else grossTotal += Math.abs(d.total);
    } else {
      incompleteCount += 1;
    }
    if (nc) ncCount += 1;
  }
  const breakdown =
    incompleteCount === 0
      ? {
          netoAfecto,
          exento: bridgeExento,
          iva: bridgeIva,
          otrosAjustes,
          total: bridgeTotal,
          netoSinIva: netoAfecto + bridgeExento,
        }
      : null;
  return {
    neto: breakdown?.netoAfecto ?? null,
    exento: breakdown?.exento ?? null,
    iva: breakdown?.iva ?? null,
    total: breakdown?.total ?? null,
    grossTotal: breakdown ? grossTotal : null,
    ncTotal: breakdown ? ncTotal : null,
    ncCount,
    breakdown,
    incompleteCount,
  };
}
