/* Adaptadores API → props presentacionales. Puros y testeables: traducen
 * los tipos del OpenAPI generado a los tipos de UI de los selectores
 * (presentacionales, prop-driven). Mantiene la frontera limpia: los tipos
 * generados NO se filtran a los componentes de presentación. */
import type { ManagementAccountNode } from "@/lib/api/management";
import type { ManagementAccountOption } from "./types";

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
