/* Capa de datos — info de conexión del MCP (para la pantalla Administración → MCP). El endpoint
   `GET /api/mcp/connection` NO está tipado en el OpenAPI (devuelve un objeto libre), así que
   declaramos el shape acá de forma DEFENSIVA (todo opcional) — el FE cae a valores por defecto si
   falta un campo. Fuente de verdad del shape: api/app/api/mcp.py (server_url, auth_header, auth_bearer,
   writes_enabled, has_api_key, docs{resumen,pasos[],clientes[]}). Read-only: NO expone la key. */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface McpClienteDoc {
  nombre: string;
  soportado: boolean;
  nota?: string;
}
export interface McpConnection {
  server_url?: string;
  /** Header primario de auth (ej. "X-Api-Key"). */
  auth_header?: string;
  /** Alternativa Bearer para clientes que solo tienen un campo "Token" (ej. "Bearer <API-key>"). */
  auth_bearer?: string;
  writes_enabled?: boolean;
  has_api_key?: boolean;
  docs?: {
    resumen?: string;
    pasos?: string[];
    clientes?: McpClienteDoc[];
  };
}

export const mcpKeys = {
  connection: ["mcp", "connection"] as const,
};

/** `GET /api/mcp/connection` — cómo conectar el MCP (URL + auth + instructivo por cliente). El backend
 *  mantiene el instructivo al día (incluido cuando OAuth pase a soportado en fase 3). */
export function useMcpConnection(enabled = true) {
  return useQuery({
    queryKey: mcpKeys.connection,
    queryFn: () => api.get<McpConnection>("/api/mcp/connection"),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
