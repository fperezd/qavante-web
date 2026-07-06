import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { usersKeys } from "./users";
import type { components } from "./types";

/* Capa de datos — N:M multi-empresa logueado (ADR-0049, qavante-api #351/#352/#354).
   Una persona puede pertenecer a varias empresas; `is_active` marca la de la
   sesión actual. Cambiar de empresa re-emite la cookie de sesión (el backend
   revoca la vieja) → tras el switch hay que recargar para que los Server
   Components lean el nuevo tenant. Tipos generados (regla 3). */

export type MeTenant = components["schemas"]["MeTenant"];
export type MeTenantsResponse = components["schemas"]["MeTenantsResponse"];
export type CreateTenantBody = components["schemas"]["CreateTenantRequest"];
export type CreatedTenant = components["schemas"]["CreatedTenant"];
export type SwitchTenantBody = components["schemas"]["SwitchTenantRequest"];
export type UpdateTenantBody = components["schemas"]["TenantUpdateRequest"];

export const tenantKeys = {
  mine: ["me", "tenants"] as const,
};

/** `GET /api/me/tenants` — empresas del usuario logueado (para el selector). */
export function useMyTenants(enabled = true) {
  return useQuery({
    queryKey: tenantKeys.mine,
    queryFn: () => api.get<MeTenantsResponse>("/api/me/tenants"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/me/active-tenant` — cambia la empresa activa (valida membership →
    403 si no pertenece; re-emite la cookie de sesión). NO retry. */
export function useSwitchTenant() {
  return useMutation({
    mutationFn: (tenantId: string) =>
      api.post<void>("/api/me/active-tenant", { body: { tenant_id: tenantId } }),
  });
}

/** `POST /api/me/tenants` — crea una empresa nueva (el usuario queda owner; 201).
    NO cambia la empresa activa (para eso, switch). NO retry. */
export function useCreateTenant() {
  return useMutation({
    mutationFn: (body: CreateTenantBody) => api.post<CreatedTenant>("/api/me/tenants", { body }),
  });
}

/** `PUT /api/admin/tenant` — edita los datos de la empresa ACTIVA (sin path param:
    el backend usa el tenant de la sesión). Partial update (todos los campos
    opcionales). Al terminar invalida la lista de empresas y `/api/me` (el nombre
    se muestra en el header/selector). NO retry. */
export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTenantBody) => api.put<void>("/api/admin/tenant", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKeys.mine });
      // `/api/me` (nombre en header/selector) → su key es ["users","me"], no ["me"].
      qc.invalidateQueries({ queryKey: usersKeys.me() });
    },
  });
}
