/* Capa de datos — Management: árbol de cuentas de gestión + dimensiones
 * (vistas de gestión). Read-only en este PR (las mutaciones create/move/
 * toggle van en PRs posteriores). Tipos del OpenAPI generado (`./types`),
 * NUNCA hand-rolled (CLAUDE.md regla 3). Patrón = treasury.ts / users.ts.
 *
 * No cablea UI: alimenta `ManagementAccountSelect` / editores de árbol
 * (presentacionales) en PRs siguientes, detrás de feature flags (ADR-0008).
 * `move` real = `{new_parent_id}` sin `sort_order` (ADR-0009, 2026-05-17). */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type ManagementAccountNode = components["schemas"]["ManagementAccountNode"];
export type ManagementAccountTreeResponse = components["schemas"]["ManagementAccountTreeResponse"];
export type ManagementDimension = components["schemas"]["ManagementDimension"];
export type DimensionsListResponse = components["schemas"]["DimensionsListResponse"];

export const managementKeys = {
  all: ["management"] as const,
  accountsTree: (includeInactive = false) =>
    [...managementKeys.all, "accounts", "tree", { includeInactive }] as const,
  dimensions: (onlyActive = false) =>
    [...managementKeys.all, "dimensions", { onlyActive }] as const,
};

/** `GET /api/management/accounts/tree` — árbol anidado por `sort_order`. */
export function useManagementAccountsTree(opts: { includeInactive?: boolean } = {}) {
  const includeInactive = opts.includeInactive ?? false;
  return useQuery({
    queryKey: managementKeys.accountsTree(includeInactive),
    queryFn: () =>
      api.get<ManagementAccountTreeResponse>(
        `/api/management/accounts/tree${includeInactive ? "?include_inactive=true" : ""}`,
      ),
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/management/dimensions` — vistas de gestión del tenant. */
export function useManagementDimensions(opts: { onlyActive?: boolean } = {}) {
  const onlyActive = opts.onlyActive ?? false;
  return useQuery({
    queryKey: managementKeys.dimensions(onlyActive),
    queryFn: () =>
      api.get<DimensionsListResponse>(
        `/api/management/dimensions${onlyActive ? "?only_active=true" : ""}`,
      ),
    staleTime: 30_000,
    retry: false,
  });
}
