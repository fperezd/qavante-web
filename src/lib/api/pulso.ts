import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Pulso detalle (Sprint C6/C7, Documento Maestro §7, Anexo C).
   "¿Por qué está así mi Pulso?": el detalle del índice de salud que el dashboard
   muestra resumido. Score + estado + los ejes que lo componen + drivers (qué lo
   empuja arriba/abajo) + tendencia histórica.

   `GET /api/management/pulso` YA existe en el backend (#322). Tipos del OpenAPI
   generado (regla 3): antes eran hand-rolled FE-first. En el contrato,
   `components`/`drivers`/`trend` son opcionales → el `select` del hook los
   normaliza a `[]` para que la vista los consuma sin `?? []` disperso.

   El cálculo del score, pesos y drivers es lógica de negocio del backend (NO FE —
   CLAUDE.md). El FE solo muestra. Gated por `pulsoDetail` (ON en prod). */

export type PulsoComponent = components["schemas"]["PulsoComponent"];
export type PulsoDriverDetail = components["schemas"]["PulsoDriver"];
export type PulsoTrendPoint = components["schemas"]["PulsoTrendPoint"];
export type PulsoDirection = PulsoDriverDetail["direction"];
export type PulsoImpact = PulsoDriverDetail["impact"];
export type PulsoScoreReading = components["schemas"]["PulsoScoreReadingResponse"];

type RawPulsoDetail = components["schemas"]["PulsoDetailResponse"];

/** Igual al contrato pero con los arrays garantizados (el hook los default-ea). */
export interface PulsoDetailResponse extends Omit<
  RawPulsoDetail,
  "components" | "drivers" | "trend"
> {
  components: PulsoComponent[];
  drivers: PulsoDriverDetail[];
  trend: PulsoTrendPoint[];
}

export const pulsoKeys = {
  all: ["pulso"] as const,
  detail: (objetivo?: string) => [...pulsoKeys.all, "detail", objetivo ?? null] as const,
  scoreReading: (objetivo: string) => [...pulsoKeys.all, "score-reading", objetivo] as const,
};

/** `GET /api/management/pulso` — detalle del Pulso Empresa. NO retry.
 *  `objetivo` (opcional): re-pondera los ejes según lo que prioriza la empresa. El re-ponderado lo
 *  hace el BACKEND (el FE no calcula Pulso); acá solo se pasa el parámetro. Si el backend aún no lo
 *  honra, devuelve el Pulso equilibrado (sin número falso). */
export function usePulsoDetail(objetivo?: string, enabled = true) {
  return useQuery({
    queryKey: pulsoKeys.detail(objetivo),
    queryFn: () =>
      api.get<RawPulsoDetail>(
        objetivo
          ? `/api/management/pulso?objetivo=${encodeURIComponent(objetivo)}`
          : "/api/management/pulso",
      ),
    select: (d): PulsoDetailResponse => ({
      ...d,
      components: d.components ?? [],
      drivers: d.drivers ?? [],
      trend: d.trend ?? [],
    }),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Lectura D09: mantiene visible el score base y separa la reponderación elegida.
 *  No se usa como sustituto del detalle legacy hasta que el flag de objetivo esté activo. */
export function usePulsoScoreReading(objetivo: string, enabled: boolean) {
  return useQuery({
    queryKey: pulsoKeys.scoreReading(objetivo),
    queryFn: () =>
      api.get<PulsoScoreReading>(
        `/api/management/pulso/score-reading?objetivo=${encodeURIComponent(objetivo)}`,
      ),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
