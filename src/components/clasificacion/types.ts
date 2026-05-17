/* Tipos presentacionales de los selectores de clasificación.
 *
 * ⚠️ NO son tipos de contrato. Son props de UI, definidos a mano, que
 * ESPEJAN el shape vivo del backend para que los componentes sean
 * prop-driven y testeables sin `generate:api` (diferido por el drift SII —
 * reconciliation P4-2). Al integrar de verdad, el tipo generado de
 * `src/lib/api/types.ts` reemplaza estos (son estructuralmente compatibles).
 *
 * `CanonicalCategoryOption` es el subconjunto de `CanonicalCategoryMeta` que
 * el selector necesita mostrar — el contrato vivo `GET
 * /api/treasury/canonical-categories` (addendum §10.1, verificado 2026-05-16:
 * 26 valores §11 + labels, reconciliation P4-4) trae más campos; el FE
 * consume `label`/`description` de ahí, nunca los hardcodea. */

export interface CanonicalCategoryOption {
  /** `code` del enum vivo (taxonomía §11 de 26 valores). */
  code: string;
  /** Label humano que viene del backend (`CanonicalCategoryMeta.label`). */
  label: string;
  /** Descripción humana opcional (`CanonicalCategoryMeta.description`). */
  description?: string;
  /** "credit" | "debit" | "any" — `expected_direction`. Solo display. */
  expectedDirection?: "credit" | "debit" | "any";
}

/** Nodo de árbol de categorías de gestión (subset de §10.2 para el selector). */
export interface ManagementAccountOption {
  id: string;
  /** `display_name || name`. */
  displayName: string;
  /** Profundidad en el árbol (0 = raíz). Solo para indentar visualmente. */
  level: number;
  /** `false` ⇒ no seleccionable (categoría inactiva). Default seleccionable. */
  selectable?: boolean;
}

/** Valor de una vista de gestión (dimension value, subset de §10.5). */
export interface DimensionValueOption {
  id: string;
  label: string;
  level: number;
}
