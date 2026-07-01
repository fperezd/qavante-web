/* Helpers PUROS del Panel de KPIs del Libro (Ventas/Compras). Agregados de
 * lectura sobre los documentos que el backend ya descargó — presentación, no
 * cálculo financiero nuevo (el dato oficial sigue siendo el F29). Testeable. */

export interface LibroDoc {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  rut_contraparte?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
}

/** Notas de crédito del SII (reducen el neto): 60, 61, 112. */
const NC_CODES = new Set([60, 61, 112]);
export function isNotaCredito(code: number | null | undefined): boolean {
  return code != null && NC_CODES.has(code);
}

function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export interface LibroKpis {
  /** Total bruto (sin notas de crédito). */
  grossTotal: number;
  grossNeto: number;
  iva: number;
  docCount: number;
  ncCount: number;
  /** Monto total de las notas de crédito. */
  ncTotal: number;
  /** Neto de NC = bruto − notas de crédito. */
  netTotal: number;
}

export function computeLibroKpis(docs: LibroDoc[]): LibroKpis {
  let grossTotal = 0, grossNeto = 0, iva = 0, docCount = 0, ncCount = 0, ncTotal = 0;
  for (const d of docs) {
    if (isNotaCredito(d.tipo_doc)) {
      ncCount += 1;
      ncTotal += num(d.monto_total);
    } else {
      docCount += 1;
      grossTotal += num(d.monto_total);
      grossNeto += num(d.monto_neto);
      iva += num(d.monto_iva);
    }
  }
  return { grossTotal, grossNeto, iva, docCount, ncCount, ncTotal, netTotal: grossTotal - ncTotal };
}

export interface CounterpartyShare {
  rut: string;
  name: string;
  total: number;
  pct: number;
}

/** Concentración por contraparte (cliente/proveedor): top-N por monto bruto. */
export function concentrationByCounterparty(docs: LibroDoc[], topN = 5): CounterpartyShare[] {
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
export function docsToCsv(docs: LibroDoc[]): string {
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
