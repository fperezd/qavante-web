import * as React from "react";

/* Ordenamiento reusable para cualquier grilla con fechas / nombres / montos
   (regla de producto: toda grilla debe poder ordenarse). Se opera sobre el valor
   CRUDO de cada fila (la fecha ISO del backend, el monto numérico), NO el texto
   ya formateado. El primer clic en una columna usa su dirección "natural":
   fechas y montos arrancan DESC (más nueva / más grande primero), texto ASC
   (A→Z); un segundo clic invierte. Nulos siempre al final. */

export type SortDir = "asc" | "desc";
export type SortKind = "date" | "number" | "text";

export interface SortColumn<T> {
  key: string;
  kind: SortKind;
  /** Valor crudo por el que se ordena (fecha ISO, número, string). */
  get: (row: T) => string | number | null | undefined;
}

/** Dirección del primer clic por tipo. Fecha/monto → DESC (más nueva / más grande
    primero, lo que el dueño quiere ver arriba); texto → ASC (A→Z). */
function naturalDir(kind: SortKind): SortDir {
  return kind === "text" ? "asc" : "desc";
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/* Orden puro (sin React) — el corazón del hook, exportado para testear directo.
   Devuelve una copia ordenada; nulos SIEMPRE al final. */
export function sortItems<T>(items: T[], column: SortColumn<T> | undefined, dir: SortDir): T[] {
  if (!column) return items;
  const mult = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = column.get(a);
    const bv = column.get(b);
    const aEmpty = isEmpty(av);
    const bEmpty = isEmpty(bv);
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    let r: number;
    if (column.kind === "number") {
      r = (Number(av) || 0) - (Number(bv) || 0);
    } else if (column.kind === "date") {
      const at = Date.parse(String(av));
      const bt = Date.parse(String(bv));
      const aBad = Number.isNaN(at);
      const bBad = Number.isNaN(bt);
      if (aBad && bBad) return 0;
      if (aBad) return 1;
      if (bBad) return -1;
      r = at - bt;
    } else {
      r = String(av).localeCompare(String(bv), "es", { sensitivity: "base" });
    }
    return r * mult;
  });
}

export interface TableSort<T> {
  sortKey: string;
  sortDir: SortDir;
  /** Ordena por `key`; si ya era la columna activa, invierte la dirección. */
  toggle: (key: string) => void;
  /** Devuelve una copia ordenada (no muta el arreglo original). */
  sorted: (items: T[]) => T[];
}

export function useTableSort<T>(
  columns: SortColumn<T>[],
  defaultKey: string,
  initialDir?: SortDir,
): TableSort<T> {
  const colByKey = React.useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const [sortKey, setSortKey] = React.useState(defaultKey);
  const [sortDir, setSortDir] = React.useState<SortDir>(
    initialDir ?? naturalDir(colByKey.get(defaultKey)?.kind ?? "text"),
  );

  const toggle = React.useCallback(
    (key: string) => {
      const col = colByKey.get(key);
      if (!col) return;
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(naturalDir(col.kind));
      }
    },
    [colByKey, sortKey],
  );

  const sorted = React.useCallback(
    (items: T[]) => sortItems(items, colByKey.get(sortKey), sortDir),
    [colByKey, sortKey, sortDir],
  );

  return { sortKey, sortDir, toggle, sorted };
}
