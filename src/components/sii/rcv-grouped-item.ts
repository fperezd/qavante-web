/* Tipos compartidos del Libro (Ventas/Compras): el doc del RCV y la fila del modo
   "agrupado". Extraídos a un módulo propio para que rcv-list-view y rcv-sort los
   compartan sin import circular. */

import type { FacturaRow } from "./rcv-anuladas";
import type { components } from "@/lib/api/types";

type GeneratedBridgeFields = Partial<
  Pick<
    components["schemas"]["RcvDocumento"],
    | "neto_afecto"
    | "exento"
    | "iva"
    | "otros_ajustes_residual"
    | "total"
    | "complete"
    | "missing_components"
  >
>;

/** Documento RCV slim, puente tipado desde el contrato publicado por API #420. */
export interface RcvDoc extends GeneratedBridgeFields {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  rut_contraparte?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_exento?: number;
  monto_iva?: number;
  monto_total?: number;
  due_date?: string;
  due_date_source?: string;
  ref_tipo_doc?: number;
  ref_folio?: number;
  reclamado?: boolean | null;
  [key: string]: unknown;
}

/**
 * Aunque el contrato tipa el campo como string, validamos que sea una fecha civil ISO real antes
 * de publicarla. Ausencia o valor inválido siguen fallando cerrado a `null`.
 */
export function rcvDueDate(doc: RcvDoc): string | null {
  if (typeof doc.due_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(doc.due_date)) return null;
  const parsed = new Date(`${doc.due_date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === doc.due_date
    ? doc.due_date
    : null;
}

export function rcvDueDateIsEstimated(doc: RcvDoc): boolean {
  const source: RcvDoc["due_date_source"] = doc.due_date_source;
  return rcvDueDate(doc) !== null && source === "assumed_30d";
}

/** Fila del Libro en modo "agrupado": o una factura (con sus NC vinculadas) o
 *  una nota de crédito huérfana (sin factura asociada en el período). */
export type GroupedItem = { t: "fac"; row: FacturaRow<RcvDoc> } | { t: "nc"; doc: RcvDoc };
