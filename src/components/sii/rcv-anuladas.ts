/* Contención D07 para la asociación Nota de Crédito → documento. PURO/testeable.
 *
 * El contrato legacy sólo expone `ref_tipo_doc`/`ref_folio`: no incluye CodRef,
 * fecha de referencia, procedencia ni validación. Por eso ni esa referencia
 * incompleta ni una coincidencia RUT+monto autorizan a declarar una anulación o
 * a modificar una factura. Hasta que llegue el read model D07 autoritativo, las
 * NC permanecen separadas y sólo publicamos una pista de revisión fail-closed.
 *
 * El total general del Libro sigue usando todos los DTE (incluidas las NC), pero
 * esta función no asigna su efecto a un documento ni a un vencimiento concreto. */

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

export type PendingAssociationStatus =
  | "reference_effect_unknown"
  | "possible_association"
  | "ambiguous"
  | "unresolved";

export interface PendingAssociation<T extends AnulableDoc = AnulableDoc> {
  nota: T;
  status: PendingAssociationStatus;
  candidateFolios: number[];
  reason:
    | "legacy_reference_without_fiscal_effect"
    | "unique_rut_amount_match"
    | "multiple_candidates"
    | "no_candidate";
}

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
  /** En el contrato legacy ninguna NC se aplica automáticamente a una factura. */
  notasHuerfanas: T[];
  /** Pistas de revisión sin efecto fiscal ni monetario sobre un documento concreto. */
  asociacionesPendientes: PendingAssociation<T>[];
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
  const asociacionesPendientes: PendingAssociation<T>[] = [];

  for (const nc of notas) {
    let candidates: FacturaRow<T>[];
    if (tieneRef(nc)) {
      candidates = rows.filter(
        (r) =>
          r.factura.folio === nc.ref_folio &&
          (nc.ref_tipo_doc == null || r.factura.tipo_doc === nc.ref_tipo_doc),
      );
      asociacionesPendientes.push({
        nota: nc,
        status: candidates.length > 1 ? "ambiguous" : "reference_effect_unknown",
        candidateFolios: candidates.flatMap((candidate) =>
          typeof candidate.factura.folio === "number" ? [candidate.factura.folio] : [],
        ),
        reason:
          candidates.length > 1 ? "multiple_candidates" : "legacy_reference_without_fiscal_effect",
      });
      continue;
    }

    const ncRut = nc.rut_contraparte?.trim();
    const ncAmount = nc.monto_total;
    candidates =
      ncRut && typeof ncAmount === "number" && Number.isFinite(ncAmount) && mag(ncAmount) > 0
        ? rows.filter(
            (r) =>
              r.factura.rut_contraparte?.trim() === ncRut &&
              typeof r.factura.monto_total === "number" &&
              Number.isFinite(r.factura.monto_total) &&
              mag(r.factura.monto_total) === mag(ncAmount),
          )
        : [];
    asociacionesPendientes.push({
      nota: nc,
      status:
        candidates.length === 1
          ? "possible_association"
          : candidates.length > 1
            ? "ambiguous"
            : "unresolved",
      candidateFolios: candidates.flatMap((candidate) =>
        typeof candidate.factura.folio === "number" ? [candidate.factura.folio] : [],
      ),
      reason:
        candidates.length === 1
          ? "unique_rut_amount_match"
          : candidates.length > 1
            ? "multiple_candidates"
            : "no_candidate",
    });
  }

  const totalBrutas = facturas.reduce((a, f) => a + num(f.monto_total), 0);
  const totalNc = notas.reduce((a, n) => a + mag(n.monto_total), 0);
  return {
    rows,
    notasHuerfanas: notas,
    asociacionesPendientes,
    totalBrutas,
    totalNc,
    totalNetas: totalBrutas - totalNc,
  };
}

/**
 * Agrupa el subconjunto visible sin permitir que filtros de presentación cambien
 * la clasificación calculada sobre el contexto completo descargado.
 */
export function agruparVisibleConContexto<T extends AnulableDoc>(
  contextDocs: T[],
  visibleDocs: T[],
): LibroAgrupado<T> {
  const context = agruparConReferencias(contextDocs);
  const visible = agruparConReferencias(visibleDocs);
  const associationByDocument = new Map(
    context.asociacionesPendientes.map((association) => [association.nota, association]),
  );
  return {
    ...visible,
    asociacionesPendientes: visible.asociacionesPendientes.map(
      (association) => associationByDocument.get(association.nota) ?? association,
    ),
  };
}
