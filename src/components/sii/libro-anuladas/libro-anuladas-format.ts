/* Vinculación Nota de Crédito → Factura para mostrar "Anuladas" en el Libro
 * (estilo Chipax). PURO/testeable.
 *
 * Ideal: el backend expone la referencia real (ref_folio/ref_tipo del DTE) →
 * link exacto. Mientras tanto, heurística: matchea NC con factura por
 * MISMO RUT + MISMO monto_total. Cubre anulaciones totales; en parciales o
 * facturas idénticas es aproximado (marcar como referencial en la UI). */

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

const NC_CODES = new Set([60, 61, 112]);
export function isNotaCredito(code: number | null | undefined): boolean {
  return code != null && NC_CODES.has(code);
}
function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export type EstadoDoc = "vigente" | "anulada" | "parcial";

export interface FacturaRow {
  factura: LibroDoc;
  notas: LibroDoc[];
  /** monto_total de la factura menos la suma de sus NC. */
  neto: number;
  estado: EstadoDoc;
}

export interface LibroAgrupado {
  rows: FacturaRow[];
  /** NC que no matchearon ninguna factura (referencial / de otro período). */
  notasHuerfanas: LibroDoc[];
  totalBrutas: number;
  totalNc: number;
  totalNetas: number;
}

export function agruparConReferencias(docs: LibroDoc[]): LibroAgrupado {
  const facturas = docs.filter((d) => !isNotaCredito(d.tipo_doc));
  const notas = docs.filter((d) => isNotaCredito(d.tipo_doc));

  const rows: FacturaRow[] = facturas.map((f) => ({ factura: f, notas: [], neto: num(f.monto_total), estado: "vigente" }));
  const huerfanas: LibroDoc[] = [];

  for (const nc of notas) {
    // Matchea con una factura del mismo RUT y mismo monto_total que aún tenga saldo.
    const row = rows.find(
      (r) =>
        r.factura.rut_contraparte === nc.rut_contraparte &&
        num(r.factura.monto_total) === num(nc.monto_total) &&
        r.neto > 0,
    );
    if (row) {
      row.notas.push(nc);
      row.neto = num(row.factura.monto_total) - row.notas.reduce((a, n) => a + num(n.monto_total), 0);
    } else {
      huerfanas.push(nc);
    }
  }

  for (const r of rows) {
    if (r.notas.length === 0) r.estado = "vigente";
    else if (r.neto <= 0) r.estado = "anulada";
    else r.estado = "parcial";
  }

  const totalBrutas = facturas.reduce((a, f) => a + num(f.monto_total), 0);
  const totalNc = notas.reduce((a, n) => a + num(n.monto_total), 0);
  return { rows, notasHuerfanas: huerfanas, totalBrutas, totalNc, totalNetas: totalBrutas - totalNc };
}
