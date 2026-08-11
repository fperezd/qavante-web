/* Capa de datos — API keys de la empresa (para conectar el MCP de Qavante a un asistente LLM).
   Source de verdad: tag "admin" del OpenAPI.
     GET    /api/admin/api-keys            → lista (prefijo, nombre, rol, último uso, revocada)
     POST   /api/admin/api-keys            → crea (devuelve la key ENTERA una sola vez)
     DELETE /api/admin/api-keys/{key_id}   → revoca
   La key entera solo se ve al crearla; después queda el prefijo. Nunca la persistimos. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type ApiKeyListItem = components["schemas"]["ApiKeyListItem"];
export type ApiKeyListResponse = components["schemas"]["ApiKeyListResponse"];
export type ApiKeyCreateRequest = components["schemas"]["ApiKeyCreateRequest"];
export type ApiKeyCreateResponse = components["schemas"]["ApiKeyCreateResponse"];

export const apiKeysKeys = {
  all: ["api-keys"] as const,
};

/** `GET /api/admin/api-keys` — las keys de la empresa (sin la key entera, solo el prefijo). */
export function useApiKeys(enabled = true) {
  return useQuery({
    queryKey: apiKeysKeys.all,
    queryFn: () => api.get<ApiKeyListResponse>("/api/admin/api-keys"),
    enabled,
    staleTime: 30_000,
  });
}

/** `POST /api/admin/api-keys` — crea una key. La respuesta trae la key ENTERA (una vez): el caller la
 *  muestra para copiar y NO la vuelve a pedir. */
export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiKeyCreateRequest) =>
      api.post<ApiKeyCreateResponse>("/api/admin/api-keys", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apiKeysKeys.all });
    },
  });
}

/** `DELETE /api/admin/api-keys/{key_id}` — revoca una key (deja de funcionar de inmediato). */
export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      api.delete<unknown>(`/api/admin/api-keys/${encodeURIComponent(keyId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apiKeysKeys.all });
    },
  });
}

/** ¿La empresa tiene al menos una key activa (no revocada)? Deriva del listado (no necesita el
 *  endpoint sin-tipar `/api/mcp/connection`). */
export function tieneKeyActiva(list: ApiKeyListResponse | undefined): boolean {
  return (list?.items ?? []).some((k) => !k.revoked_at);
}
