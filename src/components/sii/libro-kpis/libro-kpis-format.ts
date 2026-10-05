import { exportTable, type ExportTable } from "@/lib/export/table";
/* Helpers PUROS del Panel de KPIs del Libro (Ventas/Compras): concentración por
 * contraparte y export CSV. Agregados de LECTURA sobre los documentos que el
 * backend ya descargó — presentación, no cálculo financiero nuevo (el dato
 * oficial sigue siendo el F29). Los totales (neto/IVA/NC) los da `computeRcvTotals`
 * —el mismo helper del footer— para que el hero coincida exacto con la tabla.
 * Testeable. */

import { isNotaCredito } from "../tipo-doc";
import { hasCompleteRcvBreakdown } from "../rcv-totals";
import { csv, csvCell } from "@/lib/export/csv";
import { esIdentidadDebil, normalizeRut } from "@/lib/validators/rut";
import type { RcvDoc } from "../rcv-grouped-item";

export interface CounterpartyShare {
  /** `null` cuando la contraparte llega con identidad débil (centinela de extranjero,
   *  `SIN-RUT`, `S/D`): no hay RUT que mostrar y la vista decide cómo nombrarlo. Nunca se
   *  mete una etiqueta humana en este campo, que es un dato. */
  rut: string | null;
  name: string;
  total: number;
  pct: number;
}

/** Concentración por contraparte (cliente/proveedor): top-N por monto NETO
 *  (las NC restan al total de su contraparte), `pct` sobre el neto del período —
 *  así usa el MISMO neto que el hero y una contraparte anulada no aparece inflada. */
export function concentrationByCounterparty(docs: RcvDoc[], topN = 5): CounterpartyShare[] {
  // Una sola fila parcial vuelve incierto el denominador. No se publica un top
  // aparentemente exacto basado sólo en el subconjunto completo.
  if (!docs.every(hasCompleteRcvBreakdown)) return [];
  const map = new Map<string, { rut: string | null; name: string; total: number }>();
  let grand = 0;
  for (const d of docs) {
    if (!hasCompleteRcvBreakdown(d)) return [];
    // NC RESTA (neteo); factura/boleta suma.
    const sign = isNotaCredito(d.tipo_doc) ? -1 : 1;
    /* UN CENTINELA NO ES UN RUT, Y AGRUPAR POR ÉL FUNDE EMPRESAS DISTINTAS.
       La clave era `rut_contraparte ?? razon_social`, y el comentario de acá defendía el
       fallback diciendo que así "dos contrapartes distintas sin RUT no se funden". Pero sólo
       protegía a las filas con el RUT en `null`: el SII no manda `null` para un extranjero,
       manda `55.555.555-5` para TODOS. Así que todo proveedor extranjero caía en un mismo
       bucket, sus montos se sumaban, y el bucket se quedaba con la PRIMERA `razon_social` —
       una fila que dice "ACME concentra $X" donde $X incluye la plata de otra empresa.
       Los libros traen además `SIN-RUT` y `S/D` con el mismo problema.
       `esIdentidadDebil` reconoce las tres formas, y entonces la razón social pasa a ser la
       clave de verdad, que es lo que el comentario original quería decir. */
    const identidadDebil = esIdentidadDebil(d.rut_contraparte);
    const key = identidadDebil
      ? `sin-rut:${d.razon_social ?? "sin-identificar"}`
      : normalizeRut(d.rut_contraparte!);
    const t = sign * d.total;
    grand += t;
    const cur = map.get(key) ?? {
      /* Con identidad débil la fila NO reclama un RUT que no distingue a nadie. El nombre
         sigue siendo el de ESTA contraparte, no el de la primera que pasó, porque ahora la
         clave es el nombre. */
      rut: identidadDebil ? null : normalizeRut(d.rut_contraparte!),
      name: d.razon_social ?? "Sin nombre",
      total: 0,
    };
    cur.total += t;
    map.set(key, cur);
  }
  const denom = grand || 1;
  return (
    [...map.values()]
      // Solo neto positivo (una contraparte totalmente anulada queda en <= 0).
      .filter((v) => v.total > 0)
      .map((v) => ({ rut: v.rut, name: v.name, total: v.total, pct: (v.total / denom) * 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)
  );
}

/** Documentos con tipos conservados hasta escoger XLSX o CSV interoperable. */
export function docsToCsvTable(docs: RcvDoc[]): ExportTable {
  const headers = [
    "Tipo",
    "Folio",
    "Fecha",
    "RUT",
    "Razon social",
    "Neto afecto",
    "Exento",
    "IVA",
    "Otros/ajustes",
    "Total",
    "Desglose",
  ];
  return exportTable(
    headers,
    docs.map((d) => [
      d.tipo_doc == null ? csvCell.missing() : csvCell.integer(d.tipo_doc),
      d.folio == null ? csvCell.missing() : csvCell.integer(d.folio),
      d.fecha == null ? csvCell.missing() : csvCell.date(d.fecha),
      d.rut_contraparte == null ? csvCell.missing() : csvCell.identifier(d.rut_contraparte),
      d.razon_social == null ? csvCell.missing() : csvCell.text(d.razon_social),
      hasCompleteRcvBreakdown(d) ? csvCell.decimal(d.neto_afecto) : csvCell.missing(),
      hasCompleteRcvBreakdown(d) ? csvCell.decimal(d.exento) : csvCell.missing(),
      hasCompleteRcvBreakdown(d) ? csvCell.decimal(d.iva) : csvCell.missing(),
      hasCompleteRcvBreakdown(d) ? csvCell.decimal(d.otros_ajustes_residual) : csvCell.missing(),
      hasCompleteRcvBreakdown(d) ? csvCell.decimal(d.total) : csvCell.missing(),
      csvCell.text(hasCompleteRcvBreakdown(d) ? "completo" : "incompleto"),
    ]),
    { eol: "\r\n" },
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function docsToCsv(docs: RcvDoc[]): string {
  const table = docsToCsvTable(docs);
  return csv(table.headers, table.rows, table.dialect);
}
