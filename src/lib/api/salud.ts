import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components, operations } from "./types";

/* Capa de datos — Salud (PULSO + Qavante Health Score, ADR-0064).

   `GET /api/management/salud` es la ÚNICA frontera de lectura de la pantalla Salud: publica
   snapshots persistidos de los dos instrumentos bajo el mismo scope financiero. El reader del
   servidor no calcula ni completa subíndices, y acá tampoco: este módulo sólo transporta.

   Los tres parámetros van EXPLÍCITOS porque el contrato los exige explícitos — no existe
   fallback de moneda ni de fecha. El `as_of` llega desde `useFinancialScope`, o sea desde el
   servidor: el reloj del browser nunca decide la fecha de corte de una cifra financiera.

   `pulso` y `qhs` pueden venir `null` por separado. Esa ausencia NO se normaliza acá a un
   objeto vacío: la vista tiene que poder distinguir "este instrumento no trae snapshot" de
   "trae snapshot con cero subíndices", y un default silencioso borra la diferencia. */

export type SaludResponse = components["schemas"]["SaludResponse"];
export type SaludScope = components["schemas"]["SaludScope"];
export type SaludScoreSnapshot = components["schemas"]["SaludScoreSnapshot"];
export type SaludSubindex = components["schemas"]["SaludSubindex"];
export type SaludDriver = components["schemas"]["SaludDriver"];
export type SaludQualityItem = components["schemas"]["SaludQualityItem"];
export type SaludTrendPoint = components["schemas"]["SaludTrendPoint"];
export type SaludInstrument = SaludScoreSnapshot["instrument"];

/** El scope del contrato, tomado del propio OpenAPI: los tres parámetros son requeridos. */
export type SaludReadScope = operations["management_salud_detail"]["parameters"]["query"];

export const saludKeys = {
  all: ["salud"] as const,
  detail: (scope: SaludReadScope | null) => [...saludKeys.all, "detail", scope] as const,
};

function saludQuery(scope: SaludReadScope): string {
  return new URLSearchParams({
    legal_entity_id: scope.legal_entity_id,
    currency: scope.currency,
    as_of: scope.as_of,
  }).toString();
}

/** `GET /api/management/salud`. Sin scope no se consulta; sin reintento, para que un fallo
 *  se declare como fallo en vez de quedar como una pantalla que carga para siempre. */
export function useSalud(scope: SaludReadScope | null) {
  return useQuery({
    queryKey: saludKeys.detail(scope),
    queryFn: () => api.get<SaludResponse>(`/api/management/salud?${saludQuery(scope!)}`),
    enabled: scope !== null,
    staleTime: 30_000,
    retry: false,
  });
}
