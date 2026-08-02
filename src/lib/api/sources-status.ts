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

export type SyncLevel = "ok" | "warning" | "caido" | "error";

export interface SyncAggregate {
  /** Severidad global: error > caido > warning > ok. */
  level: SyncLevel;
  /** Última sincronización más reciente entre las fuentes (ISO), o null. */
  lastSync: string | null;
  /** Cantidad de fuentes con problemas (state != 'ok'). */
  problemCount: number;
}

/** ¿La fuente está CAÍDA de verdad? `unavailable` que YA sincronizó alguna vez (tiene `last_sync`)
 *  es un caído real (ej. la sesión del banco se cayó, BICE 503 `bice_session_unavailable`), no un
 *  placeholder de Fase 2 — esos vienen SIN `last_sync` y se siguen ignorando (auditoría UX F-03).
 *  Fernando 2026-08-02: el header debe distinguir "caído" de "con errores". */
export function isSourceCaida(s: SourceStatus): boolean {
  return s.state === "unavailable" && !!s.last_sync;
}

const LEVEL_RANK: Record<SyncLevel, number> = { ok: 0, warning: 1, caido: 2, error: 3 };

/** Agrega el estado de las fuentes a un resumen para el indicador del header. */
export function aggregateSyncStatus(sources: SourceStatus[]): SyncAggregate {
  let level: SyncLevel = "ok";
  let lastSync: string | null = null;
  let problemCount = 0;
  const bump = (l: SyncLevel) => {
    if (LEVEL_RANK[l] > LEVEL_RANK[level]) level = l;
  };

  for (const s of sources) {
    /* "missing" (sin conectar), "syncing" (sincronizando ahora) y "unavailable" SIN last_sync (Fase 2,
       nunca conectada) NO son errores del dueño: no pintan el header. Solo cuenta lo CONECTADO que
       falla ("error"), se cayó ("unavailable" con last_sync) o quedó viejo ("stale"). Antes cualquier
       no-ok metía "warning" → el header vivía en alarma por fuentes de Fase 2 fantasma (F-03); y un
       banco caído (unavailable) quedaba INVISIBLE (ni en el agregado ni en el detalle). */
    if (s.state === "error") {
      bump("error");
      problemCount += 1;
    } else if (isSourceCaida(s)) {
      bump("caido");
      problemCount += 1;
    } else if (s.state === "stale") {
      bump("warning");
      problemCount += 1;
    }
    if (s.last_sync && (!lastSync || s.last_sync > lastSync)) lastSync = s.last_sync;
  }

  return { level, lastSync, problemCount };
}
