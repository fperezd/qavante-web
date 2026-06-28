import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Estado de las fuentes (sync). Agrega el estado de todas las
   integraciones del tenant (SII, banco, TGR, Dirección del Trabajo, Buk, etc.):
   estado operacional + última sincronización + motivo. Alimenta el indicador de
   sync del header.

   ⚠️ `GET /api/sources/status` existe pero es **api-key-only** (no acepta la
   cookie de sesión → 401 "Falta X-Api-Key"). FE-first: construido contra el
   contrato; gated por `syncStatus` (OFF) hasta que CC-API lo migre a
   require_session. Tipos generados (regla 3). */

export type SourceStatus = components["schemas"]["SourceStatusResponse"];
export type SourcesStatusListResponse = components["schemas"]["SourcesStatusListResponse"];

export const sourcesStatusKeys = {
  all: ["sources-status"] as const,
};

/** `GET /api/sources/status` — estado agregado de todas las fuentes del tenant. */
export function useSourcesStatus(enabled = true) {
  return useQuery({
    queryKey: sourcesStatusKeys.all,
    // skipAuthRetry: hoy el endpoint es api-key-only → un 401 acá NO debe
    // expulsar al login; que caiga como error del indicador. (Además gated OFF.)
    queryFn: () =>
      api.get<SourcesStatusListResponse>("/api/sources/status", { skipAuthRetry: true }),
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // refresca cada 5 min mientras la pantalla está abierta
    retry: false,
  });
}

export type SyncLevel = "ok" | "warning" | "error";

export interface SyncAggregate {
  /** Severidad global: error gana sobre warning, warning sobre ok. */
  level: SyncLevel;
  /** Última sincronización más reciente entre las fuentes (ISO), o null. */
  lastSync: string | null;
  /** Cantidad de fuentes con problemas (state != 'ok'). */
  problemCount: number;
}

/** Agrega el estado de las fuentes a un resumen para el indicador del header. */
export function aggregateSyncStatus(sources: SourceStatus[]): SyncAggregate {
  let level: SyncLevel = "ok";
  let lastSync: string | null = null;
  let problemCount = 0;

  for (const s of sources) {
    if (s.state === "error") level = "error";
    else if (s.state !== "ok" && level !== "error") level = "warning";
    if (s.state !== "ok") problemCount += 1;
    if (s.last_sync && (!lastSync || s.last_sync > lastSync)) lastSync = s.last_sync;
  }

  return { level, lastSync, problemCount };
}
