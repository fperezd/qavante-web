/* Reader de actividad registrada (#65; contrato qavante-api#332).
 *
 * No usa `src/lib/api/types.ts` aún: ese archivo se genera contra el OpenAPI desplegado y la
 * ruta recién fue fusionada en el backend. Esta frontera reproduce sólo el contrato publicado
 * en `docs/contracts/openapi.snapshot.json` de qavante-api#332, para no inventar campos ni
 * esperar que una regeneración contra producción borre tipos ya vigentes. */
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export type ActivityLogSource = "reversible_action" | "audit_event" | "sync_run";

export interface ActivityLogItem {
  source: ActivityLogSource;
  source_id: string;
  event_type: string;
  summary: string;
  created_at: string;
  /** Sólo `sync_run` lo informa hoy. Ausente no significa éxito ni fracaso. */
  outcome: string | null;
}

export interface ActivityLogListResponse {
  items: ActivityLogItem[];
  total: number;
}

export interface ActivityLogParams {
  source?: ActivityLogSource;
  limit?: number;
  offset?: number;
}

export const activityLogKeys = {
  all: ["activity-log"] as const,
  list: (params: ActivityLogParams) => [...activityLogKeys.all, "list", params] as const,
};

function buildQuery(params: ActivityLogParams): string {
  const query = new URLSearchParams();
  if (params.source) query.set("source", params.source);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

/** Hechos persistidos de fuentes explícitas, más recientes primero. No es actividad exhaustiva. */
export function useActivityLog(params: ActivityLogParams, enabled = true) {
  return useQuery({
    queryKey: activityLogKeys.list(params),
    queryFn: () => api.get<ActivityLogListResponse>(`/api/activity-log${buildQuery(params)}`),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
