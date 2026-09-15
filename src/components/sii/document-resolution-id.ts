import type { BheRecibida } from "@/lib/api/sii";
import type { RcvDoc } from "./rcv-grouped-item";

function normalizedRut(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[.\s]/g, "")
    .toUpperCase();
}

const DTE_CORRECTOR_TYPES = new Set([56, 61, 111, 112]);

export function isDteCorrector(doc: Pick<RcvDoc, "tipo_doc">): boolean {
  return typeof doc.tipo_doc === "number" && DTE_CORRECTOR_TYPES.has(doc.tipo_doc);
}

/** Misma clave natural persistida por el importador RCV del API. */
export function rcvSourceExternalId(doc: RcvDoc): string | null {
  if (doc.tipo_doc == null || doc.folio == null || doc.rut_contraparte == null) return null;
  const type = Number(doc.tipo_doc);
  const folio = Number(doc.folio);
  const rut = normalizedRut(doc.rut_contraparte);
  if (!Number.isInteger(type) || type <= 0 || !Number.isInteger(folio) || folio <= 0 || !rut) {
    return null;
  }
  return `${type}-${folio}-${rut}`;
}

/** Misma identidad estable del cache BHE: `YYYYMM:rut_emisor:folio`. */
export function bheSourceExternalId(doc: BheRecibida): string | null {
  const period = String(doc.periodo ?? doc.fecha_emision ?? "")
    .slice(0, 7)
    .replace("-", "");
  const rut = normalizedRut(doc.rut_emisor);
  if (doc.folio == null) return null;
  const folio = Number(doc.folio);
  if (!/^\d{6}$/.test(period) || !rut || !Number.isInteger(folio) || folio <= 0) return null;
  return `${period}:${rut}:${folio}`;
}
