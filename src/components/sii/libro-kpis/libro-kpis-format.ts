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

/** Concentración por contraparte (cliente/proveedor): top-N por monto NETO
 *  (las NC restan al total de su contraparte), `pct` sobre el neto del período —
 *  así usa el MISMO neto que el hero y una contraparte anulada no aparece inflada. */
export function concentrationByCounterparty(docs: RcvDoc[], topN = 5): CounterpartyShare[] {
  const map = new Map<string, { rut: string; name: string; total: number }>();
  let grand = 0;
  for (const d of docs) {
    // NC RESTA (neteo); factura/boleta suma.
    const sign = isNotaCredito(d.tipo_doc) ? -1 : 1;
    // Clave por RUT; si no hay RUT, por razón social — así dos contrapartes
    // distintas sin RUT no se funden en un único bucket "—".
    const key = d.rut_contraparte ?? d.razon_social ?? "sin-identificar";
    const t = sign * num(d.monto_total);
    grand += t;
    const cur = map.get(key) ?? {
      rut: d.rut_contraparte ?? "—",
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

/** Escapa una celda CSV: entrecomilla si tiene separador/comillas/salto de línea
 *  (convención RFC 4180 — duplica las comillas internas). */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
      d.razon_social ?? "",
      num(d.monto_neto),
      num(d.monto_iva),
      num(d.monto_total),
    ]
      .map(csvCell)
      .join(";"),
  );
  return [headers.join(";"), ...rows].join("\r\n");
}
