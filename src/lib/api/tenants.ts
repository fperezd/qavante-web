import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
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
