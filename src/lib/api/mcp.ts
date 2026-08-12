/* Capa de datos — info de conexión del MCP (para la pantalla Administración → MCP).
   `GET /api/mcp/connection` YA está TIPADO en el OpenAPI (`McpConnectionInfo`, CC-API #925), así que
   consumimos el tipo del contrato (regla 3), no un shape hand-rolled. El backend arregló el 500 (era un
   lookup de `has_api_key` sin scope de tenant → RLS; #924-api) y ahora responde 200 con la cookie del
   admin. La VISTA igual cae a valores por defecto si el endpoint no responde (defensa). Read-only: NO
   expone la key. */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type McpConnectionInfo = components["schemas"]["McpConnectionInfo"];
export type McpConnectionClient = components["schemas"]["McpConnectionClient"];

export const mcpKeys = {
  connection: ["mcp", "connection"] as const,
};

/** `GET /api/mcp/connection` — cómo conectar el MCP (URL + auth + instructivo por cliente). El backend
 *  mantiene el instructivo al día (incluido `oauth_enabled` cuando OAuth pase a soportado). */
export function useMcpConnection(enabled = true) {
  return useQuery({
    queryKey: mcpKeys.connection,
    queryFn: () => api.get<McpConnectionInfo>("/api/mcp/connection"),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
