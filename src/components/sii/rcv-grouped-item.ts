/* Tipos compartidos del Libro (Ventas/Compras): el doc del RCV y la fila del modo
   "agrupado". Extraídos a un módulo propio para que rcv-list-view y rcv-sort los
   compartan sin import circular. */

import type { FacturaRow } from "./rcv-anuladas";

export interface RcvDoc {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  rut_contraparte?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
  /** Referencia del DTE (SII): la NC/ND apunta al documento que modifica. */
  ref_tipo_doc?: number;
  ref_folio?: number;
  [key: string]: unknown;
}

/** Fila del Libro en modo "agrupado": o una factura (con sus NC vinculadas) o
 *  una nota de crédito huérfana (sin factura asociada en el período). */
export type GroupedItem =
  | { t: "fac"; row: FacturaRow<RcvDoc> }
  | { t: "nc"; doc: RcvDoc };
