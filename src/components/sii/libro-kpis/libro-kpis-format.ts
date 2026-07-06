/* Helpers PUROS del Panel de KPIs del Libro (Ventas/Compras): concentración por
 * contraparte y export CSV. Agregados de LECTURA sobre los documentos que el
 * backend ya descargó — presentación, no cálculo financiero nuevo (el dato
 * oficial sigue siendo el F29). Los totales (neto/IVA/NC) los da `computeRcvTotals`
 * —el mismo helper del footer— para que el hero coincida exacto con la tabla.
 * Testeable. */

import { isNotaCredito } from "../tipo-doc";
import type { RcvDoc } from "../rcv-grouped-item";

function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export interface CounterpartyShare {
  rut: string;
  name: string;
  total: number;
  pct: number;
}

/** Concentración por contraparte (cliente/proveedor): top-N por monto bruto,
 *  excluyendo notas de crédito. `pct` es sobre el bruto del período. */
export function concentrationByCounterparty(docs: RcvDoc[], topN = 5): CounterpartyShare[] {
  const map = new Map<string, { name: string; total: number }>();
  let grand = 0;
  for (const d of docs) {
    if (isNotaCredito(d.tipo_doc)) continue;
    const rut = d.rut_contraparte ?? "—";
    const t = num(d.monto_total);
    grand += t;
    const cur = map.get(rut) ?? { name: d.razon_social ?? "Sin nombre", total: 0 };
    cur.total += t;
    map.set(rut, cur);
  }
  const denom = grand || 1;
  return [...map.entries()]
    .map(([rut, v]) => ({ rut, name: v.name, total: v.total, pct: (v.total / denom) * 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}

/** Serializa los documentos a CSV (separador `;` — convención Excel es-CL). */
export function docsToCsv(docs: RcvDoc[]): string {
  const headers = ["Tipo", "Folio", "Fecha", "RUT", "Razon social", "Neto", "IVA", "Total"];
  const rows = docs.map((d) =>
    [
      d.tipo_doc ?? "",
      d.folio ?? "",
      d.fecha ?? "",
      d.rut_contraparte ?? "",
      `"${(d.razon_social ?? "").replace(/"/g, '""')}"`,
      num(d.monto_neto),
      num(d.monto_iva),
      num(d.monto_total),
    ].join(";"),
  );
  return [headers.join(";"), ...rows].join("\r\n");
}
