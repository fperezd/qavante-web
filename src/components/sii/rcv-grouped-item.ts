/* Tipos compartidos del Libro (Ventas/Compras): el doc del RCV y la fila del modo
   "agrupado". Extraídos a un módulo propio para que rcv-list-view y rcv-sort los
   compartan sin import circular. */

import type { FacturaRow } from "./rcv-anuladas";
import type { components } from "@/lib/api/types";

/** Documento del Libro tipado desde el contrato OpenAPI. El RCV slim puede omitir campos. */
export type RcvDoc = Partial<components["schemas"]["RcvDocumento"]> & {
  tipo_doc?: number | null;
  folio?: number | null;
  fecha?: string | null;
  rut_contraparte?: string | null;
  razon_social?: string | null;
  monto_neto?: number | null;
  /** Monto exento (exportaciones / ventas exentas). Puede no venir en el slim aún. */
  monto_exento?: number | null;
  monto_iva?: number | null;
  monto_total?: number | null;
  /** Referencia del DTE (SII): la NC/ND apunta al documento que modifica. */
  ref_tipo_doc?: number | null;
  ref_folio?: number | null;
  /** El receptor RECLAMÓ el documento en el SII (rechazado) → no cuenta como costo/crédito/ingreso;
   *  su monto está en $0. El FE pinta una "R". `null` = dato de cache anterior a #744. */
  reclamado?: boolean | null;
  [key: string]: unknown;
};

/** Fila del Libro en modo "agrupado": o una factura (con sus NC vinculadas) o
 *  una nota de crédito huérfana (sin factura asociada en el período). */
export type GroupedItem = { t: "fac"; row: FacturaRow<RcvDoc> } | { t: "nc"; doc: RcvDoc };
