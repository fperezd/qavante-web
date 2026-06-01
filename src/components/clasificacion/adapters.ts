/* Adaptadores API → props presentacionales. Puros y testeables: traducen
 * los tipos del OpenAPI generado a los tipos de UI de los selectores
 * (presentacionales, prop-driven). Mantiene la frontera limpia: los tipos
 * generados NO se filtran a los componentes de presentación. */
import type {
  ManagementAccountNode,
  ManagementDimension,
  ManagementDimensionValue,
} from "@/lib/api/management";
import type { CanonicalCategoryMeta } from "@/lib/api/treasury";
import type {
  CanonicalCategoryOption,
  DimensionValueTreeRow,
  ManagementAccountOption,
  ManagementAccountTreeRow,
  ManagementDimensionRow,
} from "./types";

const DIRECTIONS = ["credit", "debit", "any"] as const;
type Direction = (typeof DIRECTIONS)[number];

function toDirection(v: string): Direction | undefined {
  return (DIRECTIONS as readonly string[]).includes(v) ? (v as Direction) : undefined;
}

/** `CanonicalCategoryMeta` (API §10.1) → opción del `CanonicalCategorySelect`.
 *  El FE consume `label`/`description` del backend, nunca los hardcodea. */
export function toCanonicalCategoryOptions(
  meta: CanonicalCategoryMeta[],
): CanonicalCategoryOption[] {
  return meta.map((m) => ({
    code: m.code,
    label: m.label,
    description: m.description,
    expectedDirection: toDirection(m.expected_direction),
  }));
}

/** Aplana el árbol (pre-orden DFS) a la lista que consume
 *  `ManagementAccountSelect`. Respeta el `level` del backend para indentar;
 *  `active=false` ⇒ `selectable=false` (se muestra como "(inactiva)"). */
export function flattenManagementAccounts(
  nodes: ManagementAccountNode[],
): ManagementAccountOption[] {
  const out: ManagementAccountOption[] = [];
  const walk = (list: ManagementAccountNode[]) => {
    for (const n of list) {
      out.push({
        id: n.id,
        displayName: n.display_name || n.name,
        level: n.level,
        selectable: n.active,
      });
      if (n.children && n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Aplana el árbol (pre-orden DFS) a filas del EDITOR — más campos que el
 *  selector (code/type/active/is_visible/parent_id) para mostrar badges y
 *  accionar por nodo. Incluye nodos inactivos (el editor decide cómo
 *  mostrarlos). */
export function toManagementAccountTreeRows(
  nodes: ManagementAccountNode[],
): ManagementAccountTreeRow[] {
  const out: ManagementAccountTreeRow[] = [];
  const walk = (list: ManagementAccountNode[]) => {
    for (const n of list) {
      out.push({
        id: n.id,
        name: n.display_name || n.name,
        rawName: n.name,
        displayName: n.display_name ?? "",
        code: n.code,
        level: n.level,
        type: n.type,
        destination: n.destination,
        parentId: n.parent_id ?? null,
        active: n.active,
        isVisible: n.is_visible,
        description: n.description ?? "",
        affectsPulso: n.affects_pulso,
      });
      if (n.children && n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** `ManagementDimension[]` (API §15) → filas del editor de vistas de gestión. */
export function toManagementDimensionRows(dims: ManagementDimension[]): ManagementDimensionRow[] {
  return dims.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description ?? "",
    dataType: d.data_type,
    isRequired: d.is_required,
    isVisible: d.is_visible,
    allowsHierarchy: d.allows_hierarchy,
    allowsMultiple: d.allows_multiple_values,
    active: d.active,
    isSystem: d.is_system,
  }));
}

/** `ManagementDimensionValue[]` (lista PLANA del backend, con `parent_id` pero
 *  sin `level`) → filas del árbol del editor de valores. Arma el árbol por
 *  `parent_id` y calcula `level` en pre-orden. Robustez: un valor cuyo
 *  `parent_id` no está en la lista (p. ej. padre inactivo filtrado) se trata
 *  como raíz (no se pierde); un `visited` corta ciclos de datos malformados.
 *  Hermanos ordenados por `sort_order` y luego `name`. */
export function toDimensionValueTreeRows(
  values: ManagementDimensionValue[],
): DimensionValueTreeRow[] {
  const idSet = new Set(values.map((v) => v.id));
  const byParent = new Map<string, ManagementDimensionValue[]>();
  const roots: ManagementDimensionValue[] = [];
  for (const v of values) {
    const pid = v.parent_id ?? null;
    if (pid === null || !idSet.has(pid)) {
      roots.push(v);
    } else {
      const arr = byParent.get(pid);
      if (arr) arr.push(v);
      else byParent.set(pid, [v]);
    }
  }
  const sortSiblings = (a: ManagementDimensionValue, b: ManagementDimensionValue) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name);

  const out: DimensionValueTreeRow[] = [];
  const visited = new Set<string>();
  const walk = (list: ManagementDimensionValue[], level: number) => {
    for (const v of [...list].sort(sortSiblings)) {
      if (visited.has(v.id)) continue; // corta ciclos de datos
      visited.add(v.id);
      out.push({
        id: v.id,
        name: v.name,
        code: v.code ?? "",
        description: v.description ?? "",
        level,
        parentId: v.parent_id ?? null,
        active: v.active,
      });
      const children = byParent.get(v.id);
      if (children && children.length > 0) walk(children, level + 1);
    }
  };
  walk(roots, 0);
  return out;
}

/** Destinos válidos para mover `id`: todas las filas menos la propia y sus
 *  descendientes (mover un nodo dentro de su propio subárbol generaría un
 *  ciclo → 422). Genérico sobre cualquier fila con `id` + `parentId`; asume
 *  pre-orden (padre antes que hijos), como las devuelven
 *  {@link toManagementAccountTreeRows} y {@link toDimensionValueTreeRows}. */
export function excludeSelfAndDescendants<T extends { id: string; parentId: string | null }>(
  rows: T[],
  id: string,
): T[] {
  const excluded = new Set<string>([id]);
  for (const r of rows) {
    if (r.parentId && excluded.has(r.parentId)) excluded.add(r.id);
  }
  return rows.filter((r) => !excluded.has(r.id));
}
