/* Capa de datos — Management: árbol de cuentas de gestión + dimensiones
 * (vistas de gestión). Sprint C2 — PR-Mng1 agrega mutaciones de cuentas
 * (create/update/move/toggle-active/toggle-visible). Editor UI viene en
 * PR siguiente. Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled
 * (CLAUDE.md regla 3). Patrón = treasury.ts / currencies.ts / users.ts.
 *
 * Decisiones de contrato (regla 16, verificado live 2026-05-24):
 * - `POST /api/management/accounts` → 201 ManagementAccount; 404 si
 *   parent_id no existe; 409 si code duplicado; 422 validación; 403 §20.
 * - `PATCH /api/management/accounts/{id}` → 200 ManagementAccount;
 *   update parcial (campos opcionales). `code`/`type`/`destination`/
 *   `parent_id` NO mutables vía PATCH (mover usa endpoint dedicado).
 * - `POST /api/management/accounts/{id}/move` → 200 ManagementAccount;
 *   `{new_parent_id?: string | null}` sin sort_order (ADR-0009); 422 si
 *   genera ciclo.
 * - `POST /api/management/accounts/{id}/toggle-active|visible` → 200
 *   ManagementAccount con flag invertido. Sin body. */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type ManagementAccount = components["schemas"]["ManagementAccount"];
export type ManagementAccountNode = components["schemas"]["ManagementAccountNode"];
export type ManagementAccountTreeResponse = components["schemas"]["ManagementAccountTreeResponse"];
export type CreateManagementAccountRequest =
  components["schemas"]["CreateManagementAccountRequest"];
export type UpdateManagementAccountRequest =
  components["schemas"]["UpdateManagementAccountRequest"];
export type MoveManagementAccountRequest = components["schemas"]["MoveManagementAccountRequest"];
export type ManagementDimension = components["schemas"]["ManagementDimension"];
export type DimensionsListResponse = components["schemas"]["DimensionsListResponse"];
export type ManagementDimensionValue = components["schemas"]["ManagementDimensionValue"];
export type DimensionValuesListResponse = components["schemas"]["DimensionValuesListResponse"];
export type CreateDimensionRequest = components["schemas"]["CreateDimensionRequest"];
export type UpdateDimensionRequest = components["schemas"]["UpdateDimensionRequest"];
export type CreateDimensionValueRequest = components["schemas"]["CreateDimensionValueRequest"];
export type UpdateDimensionValueRequest = components["schemas"]["UpdateDimensionValueRequest"];
export type MoveDimensionValueRequest = components["schemas"]["MoveDimensionValueRequest"];
export type DimensionAssignment = components["schemas"]["DimensionAssignment"];
export type CreateAssignmentRequest = components["schemas"]["CreateAssignmentRequest"];

export const managementKeys = {
  all: ["management"] as const,
  accountsTree: (includeInactive = false) =>
    [...managementKeys.all, "accounts", "tree", { includeInactive }] as const,
  dimensions: (onlyActive = false) =>
    [...managementKeys.all, "dimensions", { onlyActive }] as const,
  dimensionValues: (dimensionId: string) =>
    [...managementKeys.all, "dimensions", dimensionId, "values"] as const,
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

/** `GET /api/management/dimensions` — vistas de gestión del tenant. `enabled`
 *  (default true) permite gatearla por flag desde el caller. */
export function useManagementDimensions(opts: { onlyActive?: boolean; enabled?: boolean } = {}) {
  const onlyActive = opts.onlyActive ?? false;
  return useQuery({
    queryKey: managementKeys.dimensions(onlyActive),
    // skipAuthRetry: el endpoint sigue api-key-only → un 401 con cookie NO debe
    // expulsar al admin a /login (cae como error del query). Ver STATE_OF_THE_TRAIN.
    queryFn: () =>
      api.get<DimensionsListResponse>(
        `/api/management/dimensions${onlyActive ? "?only_active=true" : ""}`,
        { skipAuthRetry: true },
      ),
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
    retry: false,
  });
}

/** Dimensiones activas+visibles con sus valores, para el selector de vistas en
 *  el drawer de clasificación. Compone `useManagementDimensions` + `useQueries`
 *  (un GET de valores por dimensión). Todo gateado por `enabled` (el flag
 *  `managementDimensions`): con `enabled=false` no dispara NINGÚN request —
 *  importante porque el endpoint sigue api-key-only y un 401 con cookie podría
 *  gatillar el redirect a /login del cliente. */
export function useClassificationDimensions(enabled: boolean): {
  data: Array<{ dimension: ManagementDimension; values: ManagementDimensionValue[] }>;
  isLoading: boolean;
  isError: boolean;
} {
  const dimsQuery = useManagementDimensions({ onlyActive: true, enabled });
  const dims = (dimsQuery.data?.items ?? []).filter((d) => d.active && d.is_visible);
  const valueQueries = useQueries({
    queries: dims.map((d) => ({
      queryKey: managementKeys.dimensionValues(d.id),
      queryFn: () =>
        api.get<DimensionValuesListResponse>(`/api/management/dimensions/${d.id}/values`, {
          skipAuthRetry: true,
        }),
      enabled: enabled && d.id !== "",
      staleTime: 30_000,
      retry: false,
    })),
  });
  return {
    data: dims.map((dimension, i) => ({
      dimension,
      values: valueQueries[i]?.data?.items ?? [],
    })),
    isLoading: dimsQuery.isLoading || valueQueries.some((q) => q.isLoading),
    isError: dimsQuery.isError || valueQueries.some((q) => q.isError),
  };
}

/** `GET /api/management/dimensions/{id}/values` — valores (lista plana con
 *  `parent_id`; la jerarquía/level la deriva el adapter de UI en su PR). Solo
 *  corre con `dimensionId` no vacío (`enabled`). */
export function useDimensionValues(dimensionId: string) {
  return useQuery({
    queryKey: managementKeys.dimensionValues(dimensionId),
    queryFn: () =>
      api.get<DimensionValuesListResponse>(`/api/management/dimensions/${dimensionId}/values`, {
        skipAuthRetry: true,
      }),
    enabled: dimensionId !== "",
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/management/accounts` — crear cuenta. 403 si rol sin permiso
 *  de escritura (§20); 404 si parent_id no existe; 409 si code duplicado;
 *  422 si dominio inválido. Invalida el árbol al éxito. */
export function useCreateManagementAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateManagementAccountRequest) =>
      api.post<ManagementAccount>("/api/management/accounts", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `PATCH /api/management/accounts/{id}` — update parcial. Solo `name`,
 *  `display_name`, `description`, `affects_pulso`, `is_visible`,
 *  `sort_order` (campos del schema). `code`/`type`/`destination`/
 *  `parent_id` NO mutables vía PATCH (mover usa endpoint dedicado). */
export function useUpdateManagementAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      body,
    }: {
      accountId: string;
      body: UpdateManagementAccountRequest;
    }) => api.patch<ManagementAccount>(`/api/management/accounts/${accountId}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `POST /api/management/accounts/{id}/move` — reparenta la cuenta.
 *  Body `{new_parent_id?: string | null}` sin sort_order (ADR-0009).
 *  422 si el move generaría un ciclo. Invalida el árbol al éxito. */
export function useMoveManagementAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, body }: { accountId: string; body: MoveManagementAccountRequest }) =>
      api.post<ManagementAccount>(`/api/management/accounts/${accountId}/move`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `POST /api/management/accounts/{id}/toggle-active` — invierte el flag
 *  `is_active`. Sin body. Las cuentas inactivas no aparecen en el árbol
 *  por defecto (ver `useManagementAccountsTree({includeInactive: true})`
 *  para verlas). NO borra — análogo a §17.5 de reglas. */
export function useToggleManagementAccountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<ManagementAccount>(`/api/management/accounts/${accountId}/toggle-active`),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `POST /api/management/accounts/{id}/toggle-visible` — invierte el
 *  flag `is_visible`. Sin body. Las cuentas no-visibles siguen activas
 *  para el cálculo pero no se muestran en reportes/selectores estándar
 *  (ej. cuentas técnicas/transitorias). */
export function useToggleManagementAccountVisible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<ManagementAccount>(`/api/management/accounts/${accountId}/toggle-visible`),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/* ============================================================
   Sprint C2 — PR-Mng2: mutations dimensions + values + assignments

   Decisiones de contrato (regla 16, verificado live 2026-05-24):
   - `POST /api/management/dimensions` → 201 ManagementDimension.
   - `PATCH /api/management/dimensions/{id}` → 200; update parcial.
     `code` NO mutable vía PATCH (es la clave natural).
   - `POST /api/management/dimensions/{id}/values` → 201 con shape
     ManagementDimensionValue. `dimension_id` se infiere del path.
   - `PATCH /api/management/dimension-values/{id}` → 200; update parcial.
   - `POST /api/management/dimension-values/{id}/move` → 200;
     `{new_parent_id?}` sin sort_order (ADR-0009). No puede ser el
     propio valor ni un descendiente (422 si lo intenta).
   - `POST /api/management/dimension-assignments` → 201 DimensionAssignment.
     Asigna una entity (bank_movement/document/etc.) a un dimension_value.
   - `DELETE /api/management/dimension-assignments/{id}` → 204 sin body.
     Quita la asignación.
   ============================================================ */

/** `POST /api/management/dimensions` — crear vista de gestión. */
export function useCreateDimension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDimensionRequest) =>
      api.post<ManagementDimension>("/api/management/dimensions", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `PATCH /api/management/dimensions/{id}` — update parcial. `code` NO
 *  mutable (clave natural). Resto de campos opcionales. */
export function useUpdateDimension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dimensionId, body }: { dimensionId: string; body: UpdateDimensionRequest }) =>
      api.patch<ManagementDimension>(`/api/management/dimensions/${dimensionId}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `POST /api/management/dimensions/{id}/values` — crear valor de
 *  dimensión. `dimension_id` se infiere del path; el body NO lo lleva. */
export function useCreateDimensionValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      dimensionId,
      body,
    }: {
      dimensionId: string;
      body: CreateDimensionValueRequest;
    }) =>
      api.post<ManagementDimensionValue>(`/api/management/dimensions/${dimensionId}/values`, {
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `PATCH /api/management/dimension-values/{id}` — update parcial.
 *  Nota: el endpoint NO tiene `/dimensions/{dim_id}/` en el path; el
 *  valor se identifica por su id global (no por dim_id + value_id). */
export function useUpdateDimensionValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ valueId, body }: { valueId: string; body: UpdateDimensionValueRequest }) =>
      api.patch<ManagementDimensionValue>(`/api/management/dimension-values/${valueId}`, {
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `POST /api/management/dimension-values/{id}/move` — reparenta el
 *  valor dentro de su dimensión (la jerarquía es por-dimensión).
 *  `{new_parent_id?}` sin sort_order (ADR-0009). No puede ser el propio
 *  valor ni un descendiente — 422 si lo intenta. */
export function useMoveDimensionValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ valueId, body }: { valueId: string; body: MoveDimensionValueRequest }) =>
      api.post<ManagementDimensionValue>(`/api/management/dimension-values/${valueId}/move`, {
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `POST /api/management/dimension-assignments` — asigna una entity
 *  (bank_movement/document/manual_entry/financial_impact/budget_line/
 *  forecast_line/scenario_assumption/investment/debt_schedule) a un
 *  dimension_value. El backend valida que `dimension_value_id` pertenece
 *  a `dimension_id` y que la entity existe (404 si no). */
export function useCreateDimensionAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAssignmentRequest) =>
      api.post<DimensionAssignment>("/api/management/dimension-assignments", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}

/** `DELETE /api/management/dimension-assignments/{id}` — quita una
 *  asignación. 204 sin body. */
export function useDeleteDimensionAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      api.delete<void>(`/api/management/dimension-assignments/${assignmentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: managementKeys.all }),
  });
}
