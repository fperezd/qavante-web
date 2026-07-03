/* Vinculación Nota de Crédito → Factura para mostrar "Anuladas" en el Libro de
 * Ventas/Compras (estilo Chipax). PURO/testeable.
 *
 * El backend expone la referencia real del DTE (`ref_tipo_doc`/`ref_folio` en el
 * slim del RCV) → link EXACTO NC↔factura. Cuando la NC trae ref, se linkea por
 * (ref_tipo_doc === factura.tipo_doc && ref_folio === factura.folio). Si la NC no
 * trae ref (docs viejos / de otro período), cae a la heurística por MISMO RUT +
 * MISMO monto_total (aproximada, se marca "referencial" en la UI).
 *
 * Nota: NO recalcula finanzas (§17.4). Solo agrupa/presenta; el neto por fila es
 * factura.monto_total − Σ NC (aritmética de presentación, coherente con el
 * neteo de computeRcvTotals que ya alimenta los totales del período). */

import { isNotaCredito } from "./tipo-doc";

export interface AnulableDoc {
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
  [key: string]: unknown;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
/* Magnitud del monto de una NC. La data real del SII trae las NC en POSITIVO,
 * pero algunos fixtures/escenarios las traen negativas; usamos el valor absoluto
 * para que la resta sea siempre correcta (idéntico criterio que computeRcvTotals). */
function mag(v: unknown): number {
  return Math.abs(num(v));
}

/** ¿La NC trae referencia exacta al DTE de origen? */
function tieneRef(nc: AnulableDoc): boolean {
  return typeof nc.ref_folio === "number" && Number.isFinite(nc.ref_folio);
}

export type EstadoDoc = "vigente" | "anulada" | "parcial";

export interface FacturaRow<T extends AnulableDoc = AnulableDoc> {
  factura: T;
  notas: T[];
  /** monto_total de la factura menos la suma de sus NC. Puede quedar NEGATIVO
   *  si las NC referenciadas superan el monto de la factura (anomalía del SII);
   *  ver `sobreCredito`. La UI NO debe mostrar un neto negativo tal cual. */
  neto: number;
  estado: EstadoDoc;
  /** `true` si TODAS las NC vinculadas lo hicieron por ref exacta del DTE;
   *  `false` si alguna se linkeó por heurística (mostrar "referencial"). */
  matchExacto: boolean;
  /** `true` cuando la suma de las NC supera el monto de la factura (neto < 0).
   *  Suele ser un error de referencia en el SII (varias NC apuntando al mismo
   *  folio). La UI lo marca como "revisar" y no muestra el neto en negativo. */
  sobreCredito: boolean;
}

export interface LibroAgrupado<T extends AnulableDoc = AnulableDoc> {
  rows: FacturaRow<T>[];
  /** NC que no matchearon ninguna factura (referencial / de otro período). */
  notasHuerfanas: T[];
  totalBrutas: number;
  totalNc: number;
  totalNetas: number;
}

export function agruparConReferencias<T extends AnulableDoc>(docs: T[]): LibroAgrupado<T> {
  const facturas = docs.filter((d) => !isNotaCredito(d.tipo_doc));
  const notas = docs.filter((d) => isNotaCredito(d.tipo_doc));

  const rows: FacturaRow<T>[] = facturas.map((f) => ({
    factura: f,
    notas: [],
    neto: num(f.monto_total),
    estado: "vigente",
    matchExacto: true,
    sobreCredito: false,
  }));
  const huerfanas: T[] = [];

  for (const nc of notas) {
    // 1) Ref exacta del DTE: (ref_tipo_doc, ref_folio) → (tipo_doc, folio).
    //    `ref_tipo_doc` puede venir null en algunas NC; con folio alcanza para
    //    desambiguar dentro del período, pero si viene lo exigimos.
    let row: FacturaRow<T> | undefined;
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
          // magnitud: la NC puede venir negativa; la factura siempre positiva.
          mag(r.factura.monto_total) === mag(nc.monto_total) &&
          r.neto > 0,
      );
    }
    if (row) {
      row.notas.push(nc);
      row.neto = num(row.factura.monto_total) - row.notas.reduce((a, n) => a + mag(n.monto_total), 0);
      if (!exacto) row.matchExacto = false;
    } else {
      huerfanas.push(nc);
    }
  }

  for (const r of rows) {
    if (r.notas.length === 0) {
      r.estado = "vigente";
      r.matchExacto = true;
    } else if (r.neto <= 0) {
      r.estado = "anulada";
      // neto < 0 ⇒ las NC superan el monto de la factura (anomalía del SII).
      r.sobreCredito = r.neto < 0;
    } else r.estado = "parcial";
  }

  const totalBrutas = facturas.reduce((a, f) => a + num(f.monto_total), 0);
  const totalNc = notas.reduce((a, n) => a + mag(n.monto_total), 0);
  return { rows, notasHuerfanas: huerfanas, totalBrutas, totalNc, totalNetas: totalBrutas - totalNc };
}
