/* Capa de datos — Treasury: canonical categories (tipos de movimiento).
 *
 * Contrato VIVO y CONGELADO (reconciliation P4-4): taxonomía §11/26 con
 * metadata humana. Tipos consumidos del OpenAPI generado (`./types`), NUNCA
 * hand-rolled (CLAUDE.md regla 3). Metadata read-only — `staleTime` largo.
 *
 * Esta capa NO cablea UI todavía: alimenta a `CanonicalCategorySelect` /
 * `ClassificationDrawer` (presentacionales, ya existen) en un PR posterior,
 * detrás de feature flags (ADR-0008). */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type CanonicalCategoryMeta = components["schemas"]["CanonicalCategoryMeta"];
export type CanonicalCategoriesResponse = components["schemas"]["CanonicalCategoriesResponse"];

/* Query keys co-locados por dominio — patrón vigente del repo (`usersKeys` en
   users.ts), ratificado por ADR-0007 ("seguir el patrón existente"). */
export const treasuryKeys = {
  all: ["treasury"] as const,
  canonicalCategories: () => [...treasuryKeys.all, "canonical-categories"] as const,
};

/** `GET /api/treasury/canonical-categories` — metadata congelada (P4-4). */
export function useCanonicalCategories() {
  return useQuery({
    queryKey: treasuryKeys.canonicalCategories(),
    queryFn: () => api.get<CanonicalCategoriesResponse>("/api/treasury/canonical-categories"),
    staleTime: 60 * 60 * 1000, // 1 h: contrato congelado, no cambia en sesión
    retry: false,
  });
}
