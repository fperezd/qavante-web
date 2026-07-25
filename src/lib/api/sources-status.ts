import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Estado de las fuentes (sync). Agrega el estado de todas las
   integraciones del tenant (SII, banco, TGR, Dirección del Trabajo, Buk, etc.):
   estado operacional + última sincronización + motivo. Alimenta el indicador de
   sync del header.

   ✅ Acepta cookie de sesión. Sondeado contra prod el 16-07-2026: sin auth devuelve
   `{"code":"no_session"}` — no `"Falta X-Api-Key."`, que es lo que responden los endpoints
   api-key-only (p.ej. `/api/bice/saldo`). CC-API lo migró a require_session y el comentario
   viejo quedó mintiendo: decía api-key-only y por eso acá se daba por muerto. El flag
   `syncStatus` ya está ON en prod. Tipos generados (regla 3). */

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
    /* "missing" (sin conectar) y "unavailable" (no implementada en Fase 1) NO son errores del dueño:
       no deben pintar el header rojo/ámbar. Solo lo CONECTADO que falla ("error") o quedó viejo
       ("stale") cuenta. Antes, cualquier no-ok metía "warning" → el header vivía en alarma por 8
       fuentes de Fase 2 que el tenant nunca va a conectar (auditoría UX F-03). */
    if (s.state === "error") {
      level = "error";
      problemCount += 1;
    } else if (s.state === "stale") {
      if (level !== "error") level = "warning";
      problemCount += 1;
    }
    if (s.last_sync && (!lastSync || s.last_sync > lastSync)) lastSync = s.last_sync;
  }

  return { level, lastSync, problemCount };
}
