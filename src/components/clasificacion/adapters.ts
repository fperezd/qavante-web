/* Adaptadores API → props presentacionales. Puros y testeables: traducen
 * los tipos del OpenAPI generado a los tipos de UI de los selectores
 * (presentacionales, prop-driven). Mantiene la frontera limpia: los tipos
 * generados NO se filtran a los componentes de presentación. */
import type { ManagementAccountNode } from "@/lib/api/management";
import type { CanonicalCategoryMeta } from "@/lib/api/treasury";
import type {
  CanonicalCategoryOption,
  ManagementAccountOption,
  ManagementAccountTreeRow,
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
        code: n.code,
        level: n.level,
        type: n.type,
        parentId: n.parent_id ?? null,
        active: n.active,
        isVisible: n.is_visible,
      });
      if (n.children && n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
