"use client";

import { useSourcesStatus } from "@/lib/api/sources-status";
import { useMyTenants } from "@/lib/api/tenants";
import { useUsers } from "@/lib/api/users";
import { filasHubV12, type CargaV12 } from "./administracion-v12-model";
import { AdministracionV12View } from "./administracion-v12-view";

/* Cableado de V12 · Administración (issue #75). Tres queries independientes, cada una con su
 * propio `CargaV12` mientras no responde — si una falla (p.ej. `/api/sources/status` es
 * `skipAuthRetry`, ver `sources-status.ts`) las otras dos filas igual muestran su estado: no hay
 * una sola pantalla de error que tumbe el hub entero por una fuente caída.
 *
 * Ley 8 (hallazgo de revisión, PR #95): mientras una query está en vuelo o falló, la fila NO
 * puede verse igual que una fila con hueco declarado (`estado: null`) — serían indistinguibles de
 * "esto nunca va a tener dato". `cargaDeQuery` traduce el estado de TanStack Query a `CargaV12`
 * ANTES de tocar el modelo, así que `filasHubV12`/`estadoXxx` (puros, sin React) deciden qué texto
 * mostrar para cada uno de los tres estados sin adivinar. */
function cargaDeQuery<T>(q: {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
}): CargaV12<T> {
  if (q.data !== undefined) return { tipo: "listo", valor: q.data };
  if (q.isError) return { tipo: "error" };
  return { tipo: "cargando" };
}

export interface AdministracionV12LiveProps {
  /** Flag `mcp` (ADR-0092), resuelto en el Server Component `page.tsx` — ver la nota de
   *  `resolveFeatureFlags` sólo-servidor en `feature-flags.ts`. */
  mcp: boolean;
}

export function AdministracionV12Live({ mcp }: AdministracionV12LiveProps) {
  const sourcesQuery = useSourcesStatus();
  const tenantsQuery = useMyTenants();
  const usersQuery = useUsers();

  const filas = filasHubV12({
    /* Sin filtrar por `visibleSources` acá: `estadoCredenciales` ya lo hace (es su fuente de
       verdad, la misma que V11) — filtrar dos veces sería redundante, no incorrecto, pero
       escondería en dos sitios una decisión que sólo debe vivir en uno. */
    sources: cargaDeQuery({
      data: sourcesQuery.data?.sources,
      isLoading: sourcesQuery.isLoading,
      isError: sourcesQuery.isError,
    }),
    empresas: cargaDeQuery({
      data: tenantsQuery.data?.tenants.length,
      isLoading: tenantsQuery.isLoading,
      isError: tenantsQuery.isError,
    }),
    usuarios: cargaDeQuery({
      data: usersQuery.data?.total,
      isLoading: usersQuery.isLoading,
      isError: usersQuery.isError,
    }),
    mcpVisible: mcp,
  });

  return <AdministracionV12View filas={filas} />;
}
