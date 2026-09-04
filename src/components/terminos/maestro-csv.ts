/* Export CSV del maestro de contrapartes (clientes / proveedores / honorarios) —
 * helper PURO, testeable.
 *
 * Emite una fila POR DOCUMENTO, no por contraparte: quien exporta un maestro quiere
 * el detalle (cada boleta, cada factura) y puede agrupar en Excel; al revés no se
 * puede. Los datos de la contraparte se repiten en cada fila para que la planilla
 * sea filtrable y pivoteable sin joins.
 *
 * Espeja `docsToCsv` del Libro SII y `movementsToCsv` de Caja: separador `;`
 * (convención Excel es-CL) y escape RFC 4180.
 *
 * Decisiones deliberadas:
 * - El MONTO va con su signo natural: las notas de crédito ya vienen negativas del
 *   modelo, así que `SUMA()` en Excel da el neto correcto sin intervención.
 * - Un documento RECLAMADO en el SII no cuenta como deuda (el modelo lo deja en $0).
 *   Se exporta con su monto tal cual y una columna "Reclamado" en Sí/No, para que
 *   quien lea el archivo entienda por qué un folio no suma, en vez de verlo
 *   desaparecer sin explicación.
 * - "Sin fecha" es un estado real y se rotula como tal. No se sustituye por una
 *   fecha inventada ni se deja la celda ambigua.
 */

import { tipoDocMeta } from "@/components/sii/tipo-doc";
import type { ContraparteMaestro, EstadoDoc, MaestroKind } from "./terminos-pago";

const ESTADO_LABEL: Record<EstadoDoc, string> = {
  vencido: "Vencido",
  por_vencer: "Por vencer",
  vigente: "Vigente",
  sin_fecha: "Sin fecha",
};

/** Cómo se llama la contraparte en cada maestro, para la cabecera del archivo. */
const CONTRAPARTE_LABEL: Record<MaestroKind, string> = {
  ventas: "Cliente",
  compras: "Proveedor",
  honorarios: "Profesional",
};

/** Escapa una celda CSV (RFC 4180): entrecomilla si trae separador, comillas o salto. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** `Date` → `YYYY-MM-DD`. Null/inválida → celda vacía (no se inventa fecha). */
function isoDate(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function maestroCsvHeaders(kind: MaestroKind): string[] {
  const quien = CONTRAPARTE_LABEL[kind];
  return [
    `RUT ${quien.toLowerCase()}`,
    quien,
    "Tipo documento",
    "Folio",
    "Fecha emision",
    "Monto",
    "Estado",
    "Vencimiento",
    "Dias para vencer",
    "Pagado",
    "Reclamado",
    "Termino (dias)",
  ];
}

/** Serializa el maestro a CSV: una fila por documento, en el orden recibido. */
export function maestroToCsv(cps: readonly ContraparteMaestro[], kind: MaestroKind): string {
  const rows: string[] = [];
  for (const cp of cps) {
    for (const d of cp.docs) {
      rows.push(
        [
          cp.rut ?? "",
          cp.name ?? "",
          tipoDocMeta(d.tipoDoc).label,
          d.folio ?? "",
          isoDate(d.fechaEmision) || (d.fecha ?? ""),
          Number.isFinite(d.monto) ? d.monto : "",
          ESTADO_LABEL[d.estado] ?? d.estado,
          isoDate(d.vencimiento),
          d.diasParaVencer ?? "",
          d.pagado ? "Si" : "No",
          d.reclamado ? "Si" : "No",
          cp.termino,
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }
  return [maestroCsvHeaders(kind).join(";"), ...rows].join("\r\n");
}

/** Nombre del archivo: `honorarios-2026.csv`, `clientes-ene-jul-2026.csv`… */
export function maestroCsvFilename(kind: MaestroKind, periodo?: string): string {
  const base =
    kind === "honorarios" ? "honorarios" : kind === "compras" ? "proveedores" : "clientes";
  // El label de período trae guiones y espacios ("ene–jul 2026"): se normaliza para
  // que el nombre del archivo no dependa de cómo se escriba la etiqueta en la UI.
  const slug = periodo
    ? periodo
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";
  return `${base}${slug ? `-${slug}` : ""}.csv`;
}
