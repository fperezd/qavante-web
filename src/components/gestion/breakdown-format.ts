import type { BreakdownRow } from "@/lib/api/gestion";

/* Aplana el árbol del Estado de Resultados para renderizarlo como filas, según el
   set de nodos COLAPSADOS (default: todo expandido, como Chipax). PURO/testeable. */

export interface FlatBreakdownRow {
  /** Id estable por posición en el árbol (para el set de colapsados). */
  id: string;
  row: BreakdownRow;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function flattenBreakdown(
  rows: ReadonlyArray<BreakdownRow>,
  collapsed: ReadonlySet<string>,
  parentId = "",
  depth = 0,
): FlatBreakdownRow[] {
  const out: FlatBreakdownRow[] = [];
  rows.forEach((row, i) => {
    const id = parentId ? `${parentId}/${i}` : `${i}`;
    const hasChildren = (row.children?.length ?? 0) > 0;
    const expanded = hasChildren && !collapsed.has(id);
    out.push({ id, row, depth, hasChildren, expanded });
    if (expanded && row.children) {
      out.push(...flattenBreakdown(row.children, collapsed, id, depth + 1));
    }
  });
  return out;
}

/** Etiqueta de columna de mes: "2026-02" → "Feb 2026". */
export function formatMonthColumn(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const i = Number(m[2]) - 1;
  return i >= 0 && i <= 11 ? `${meses[i]} ${m[1]}` : period;
}
