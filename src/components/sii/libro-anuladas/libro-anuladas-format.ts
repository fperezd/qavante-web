/* Vinculación Nota de Crédito → Factura para mostrar "Anuladas" en el Libro
 * (estilo Chipax). PURO/testeable.
 *
 * El backend expone la referencia real del DTE (`ref_tipo_doc`/`ref_folio` en
 * el slim del RCV) → link EXACTO NC↔factura. Cuando la NC trae ref, se linkea
 * por (ref_tipo_doc === factura.tipo_doc && ref_folio === factura.folio). Si la
 * NC no trae ref (docs viejos / de otro período), cae a la heurística por
 * MISMO RUT + MISMO monto_total (aproximada, se marca "referencial" en la UI). */

export interface LibroDoc {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  rut_contraparte?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
  /** Referencia del DTE al documento que modifica (SII). Solo en NC/ND. */
  ref_tipo_doc?: number;
  ref_folio?: number;
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
  /** `true` si TODAS las NC vinculadas lo hicieron por ref exacta del DTE;
   *  `false` si alguna se linkeó por heurística (mostrar "referencial"). */
  matchExacto: boolean;
}

/** ¿La NC trae referencia exacta al DTE de origen? */
function tieneRef(nc: LibroDoc): boolean {
  return typeof nc.ref_folio === "number" && Number.isFinite(nc.ref_folio);
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

  const rows: FacturaRow[] = facturas.map((f) => ({
    factura: f,
    notas: [],
    neto: num(f.monto_total),
    estado: "vigente",
    matchExacto: true,
  }));
  const huerfanas: LibroDoc[] = [];

  for (const nc of notas) {
    // 1) Ref exacta del DTE: (ref_tipo_doc, ref_folio) → (tipo_doc, folio).
    //    `ref_tipo_doc` puede venir null en algunas NC; con folio alcanza para
    //    desambiguar dentro del período, pero si viene lo exigimos.
    let row: FacturaRow | undefined;
    let exacto = false;
    if (tieneRef(nc)) {
      row = rows.find(
        (r) =>
          r.factura.folio === nc.ref_folio &&
          (nc.ref_tipo_doc == null || r.factura.tipo_doc === nc.ref_tipo_doc),
      );
      exacto = !!row;
    }
    // 2) Heurística (NC sin ref): mismo RUT + mismo monto_total con saldo.
    if (!row) {
      row = rows.find(
        (r) =>
          r.factura.rut_contraparte === nc.rut_contraparte &&
          num(r.factura.monto_total) === num(nc.monto_total) &&
          r.neto > 0,
      );
    }
    if (row) {
      row.notas.push(nc);
      row.neto = num(row.factura.monto_total) - row.notas.reduce((a, n) => a + num(n.monto_total), 0);
      if (!exacto) row.matchExacto = false;
    } else {
      huerfanas.push(nc);
    }
  }

  for (const r of rows) {
    if (r.notas.length === 0) {
      r.estado = "vigente";
      r.matchExacto = true;
    } else if (r.neto <= 0) r.estado = "anulada";
    else r.estado = "parcial";
  }

  const totalBrutas = facturas.reduce((a, f) => a + num(f.monto_total), 0);
  const totalNc = notas.reduce((a, n) => a + num(n.monto_total), 0);
  return { rows, notasHuerfanas: huerfanas, totalBrutas, totalNc, totalNetas: totalBrutas - totalNc };
}
