/* Capa de datos — ADAPTADOR de estado por fuente del onboarding.
 *
 * Patrón ratificado (Fernando 2026-08-12): "siempre wizard, con conexiones
 * diferibles". Cada fuente conectable (SII, banco) está en uno de 3 estados:
 *
 *   - `connected` — el backend confirma la fuente conectada y fresca.
 *   - `deferred`  — el usuario eligió "conectar después" explícitamente.
 *   - `pending`   — todavía no la conectó ni la difirió.
 *
 * ⚠️ BRECHA DE CONTRATO (verificada contra el snapshot OpenAPI del backend,
 * `qavante-api/docs/contracts/openapi.snapshot.json`, 2026-08-14):
 * `OnboardingSteps` SOLO expone `sii_connected` y `bank_connected`. **No existe
 * campo de diferimiento**. Por eso `deferredSourcesFromStatus()` devuelve hoy
 * lista vacía y el diferimiento se sostiene en memoria
 * (`src/lib/onboarding/deferred-sources.ts`) — honesto: al recargar, una fuente
 * diferida vuelve a leerse como `pending`, jamás como conectada.
 *
 * Cuando CC-API publique el campo (`steps.sii_deferred`/`bank_deferred`, o
 * `deferred_sources: string[]`), conectar el real es UNA línea en
 * `deferredSourcesFromStatus()` — nada más del FE cambia.
 */

import type { OnboardingStatus } from "./onboarding-status";
import { useOnboardingStatus } from "./onboarding-status";
import { useDeferredSources } from "@/lib/onboarding/deferred-sources";

/** Fuentes conectables que el wizard gestiona hoy. El ERP entra acá cuando exista
 *  su contrato (conexión ADICIONAL: no altera el flujo — decisión 2026-08-12). */
export const ONBOARDING_SOURCE_IDS = ["sii", "bank"] as const;

export type OnboardingSourceId = (typeof ONBOARDING_SOURCE_IDS)[number];

export type OnboardingSourceState = "connected" | "deferred" | "pending";

export type OnboardingSourceStates = Record<OnboardingSourceId, OnboardingSourceState>;

/** Fuentes que el backend reporta como conectadas. `status` ausente (loading o
 *  error) ⇒ lista vacía: sin dato NO afirmamos "conectada" (dato faltante nunca
 *  se muestra como éxito). */
export function connectedSourcesFromStatus(status?: OnboardingStatus): OnboardingSourceId[] {
  const steps = status?.steps;
  if (!steps) return [];
  const out: OnboardingSourceId[] = [];
  if (steps.sii_connected) out.push("sii");
  if (steps.bank_connected) out.push("bank");
  return out;
}

/** Fuentes que el BACKEND reporta como diferidas ("conectar después").
 *
 * 🔌 PUNTO DE CONEXIÓN (TODO CC-API): hoy el contrato no tiene el campo, así que
 * devolvemos []. Cuando exista, esto pasa a ser una línea, p.ej.:
 *
 *     return (status?.deferred_sources ?? []) as OnboardingSourceId[];
 *
 * Todo el resto del FE (guard, hub de conexiones, pasos) ya consume este helper. */
export function deferredSourcesFromStatus(status?: OnboardingStatus): OnboardingSourceId[] {
  void status; // el contrato todavía no trae diferimiento — ver el TODO de arriba.
  return [];
}

/** Estado por fuente. Precedencia: `connected` (verdad del backend) > `deferred`
 *  (elección del usuario) > `pending`. Puro → testeable sin React. */
export function deriveSourceStates(
  status: OnboardingStatus | undefined,
  locallyDeferred: readonly OnboardingSourceId[] = [],
): OnboardingSourceStates {
  const connected = new Set(connectedSourcesFromStatus(status));
  const deferred = new Set<OnboardingSourceId>([
    ...deferredSourcesFromStatus(status),
    ...locallyDeferred,
  ]);

  const states = {} as OnboardingSourceStates;
  for (const id of ONBOARDING_SOURCE_IDS) {
    states[id] = connected.has(id) ? "connected" : deferred.has(id) ? "deferred" : "pending";
  }
  return states;
}

/** Fuentes que NO están conectadas (diferidas + pendientes), en orden canónico. */
export function unconnectedSources(states: OnboardingSourceStates): OnboardingSourceId[] {
  return ONBOARDING_SOURCE_IDS.filter((id) => states[id] !== "connected");
}

export interface UseOnboardingSourcesResult {
  /** Estado por fuente. Mientras carga o si el status falla, ninguna fuente se
   *  declara conectada (ver `isUnknown`). */
  states: OnboardingSourceStates;
  /** No pudimos leer el estado real (loading o error) → la UI debe DECIRLO, no
   *  pintar "pendiente" como si fuera un hecho verificado. */
  isUnknown: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  /** `true` sólo si el backend confirmó el onboarding completado. */
  completed: boolean;
}

/** Estado por fuente del onboarding = `GET /api/onboarding/status` + los
 *  diferimientos de esta sesión. Punto único de consumo para el wizard, el guard
 *  y la entrada de retomar conexiones. */
export function useOnboardingSources(enabled = true): UseOnboardingSourcesResult {
  const query = useOnboardingStatus(enabled);
  const locallyDeferred = useDeferredSources();

  return {
    states: deriveSourceStates(query.data, locallyDeferred),
    isUnknown: !query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    completed: query.data?.completed === true,
  };
}
