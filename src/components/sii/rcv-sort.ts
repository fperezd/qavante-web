/* Orden de la tabla del Libro (Ventas/Compras). PURO/testeable.
 *
 * Ordena por cualquier columna (tipo, folio, fecha, cliente, neto, IVA, total),
 * asc/desc. Funciona sobre el doc plano (modo "detalle") y sobre la fila agrupada
 * (modo "agrupado": una factura con sus NC, o una NC huérfana) — para eso se
 * extrae el doc "representativo" de cada fila (`docOf`). */

import type { GroupedItem } from "./rcv-grouped-item";

export type SortKey = "tipo" | "folio" | "fecha" | "cliente" | "neto" | "iva" | "total";
export type SortDir = "asc" | "desc";
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface SortableDoc {
  tipo_doc?: number;
  folio?: number;
  fecha?: string;
  razon_social?: string;
  monto_neto?: number;
  monto_iva?: number;
  monto_total?: number;
}

function ymdNum(y: string, m: string, d: string): number {
  return Number(`${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`);
}

/** Convierte una fecha del SII en un número YYYYMMDD ordenable. Maneja TODOS los
 *  formatos que entrega el SII (igual que `toIsoDate`): `YYYY-M-D` (ISO, con o sin
 *  hora) y `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY` (con o sin padding). Si no
 *  parsea, devuelve 0 (van al principio en asc). */
export function fechaSortKey(fecha: string | undefined): number {
  if (!fecha) return 0;
  const s = fecha.trim();
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd?.[1] && ymd[2] && ymd[3]) return ymdNum(ymd[1], ymd[2], ymd[3]);
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (dmy?.[1] && dmy[2] && dmy[3]) return ymdNum(dmy[3], dmy[2], dmy[1]);
  return 0;
}

/** Valor comparable de un doc para una columna. Strings en minúscula; los montos
 *  ausentes van al final (‑Infinity → primeros en asc, se invierte con dir). */
export function sortValue(d: SortableDoc, key: SortKey): number | string {
  switch (key) {
    case "tipo":
      return d.tipo_doc ?? -1;
    case "folio":
      return d.folio ?? -1;
    case "fecha":
      return fechaSortKey(d.fecha);
    case "cliente":
      return (d.razon_social ?? "").toLowerCase();
    case "neto":
      return typeof d.monto_neto === "number" ? d.monto_neto : Number.NEGATIVE_INFINITY;
    case "iva":
      return typeof d.monto_iva === "number" ? d.monto_iva : Number.NEGATIVE_INFINITY;
    case "total":
      return typeof d.monto_total === "number" ? d.monto_total : Number.NEGATIVE_INFINITY;
  }
}

function cmp(a: number | string, b: number | string): number {
  if (typeof a === "string" || typeof b === "string") {
    return String(a).localeCompare(String(b), "es");
  }
  return a - b;
}

/** Doc representativo de una fila agrupada (factura, o la NC huérfana). */
export function docOf(item: GroupedItem): SortableDoc {
  return item.t === "fac" ? item.row.factura : item.doc;
}

/** Ordena docs planos (modo detalle). No muta el input. */
export function sortDocs<T extends SortableDoc>(docs: T[], sort: SortState | null): T[] {
  if (!sort) return docs;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...docs].sort((a, b) => dir * cmp(sortValue(a, sort.key), sortValue(b, sort.key)));
}

/** Ordena filas agrupadas (modo agrupado) por el doc representativo. No muta. */
export function sortGroupedItems(items: GroupedItem[], sort: SortState | null): GroupedItem[] {
  if (!sort) return items;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...items].sort(
    (a, b) => dir * cmp(sortValue(docOf(a), sort.key), sortValue(docOf(b), sort.key)),
  );
}

/** Alterna el orden de una columna: none → asc → desc → none. */
export function toggleSort(current: SortState | null, key: SortKey): SortState | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}
