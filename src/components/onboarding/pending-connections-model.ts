/* Modelo del banner "te falta conectar" — SIN React → testeable.
 *
 * Corrección del review independiente del PR #935. El banner original decía
 * "Te falta conectar Banco" con solo mirar `steps.bank_connected === false` del
 * status del onboarding. Ese booleano colapsa TRES cosas muy distintas:
 *
 *   - nunca se conectó            → "te falta conectar" es verdad;
 *   - conectada pero `stale`      → un sync transitoriamente atrasado/degradado;
 *   - conectada pero `error`      → credencial vencida, consent revocado, etc.
 *
 * A un cliente con el banco conectado y un sync degradado el banner le decía
 * "Te falta conectar Banco", contradiciendo al indicador de sincronización del
 * header (que sí distingue `stale` de `missing`). Encima el backfill dejó a
 * TODOS los tenants existentes con `completed = true`, o sea el banner los
 * alcanza a todos.
 *
 * Regla: el banner solo habla de fuentes que el estado canónico
 * (`GET /api/sources/status`) reporta como `missing`. Si no pudimos leer ese
 * estado, o la fuente no viene en la respuesta, NO afirmamos nada: los problemas
 * de una fuente ya conectada son trabajo del indicador de sync, no de un banner
 * que invita a "conectar" algo que ya está conectado.
 */

import {
  ONBOARDING_SOURCE_IDS,
  type OnboardingSourceId,
  type OnboardingSourceStates,
} from "@/lib/api/onboarding-sources";
import type { SourceStatus } from "@/lib/api/sources-status";

/** `source_code` del catálogo (`core.sources`) de cada fuente del wizard. Ojo:
 *  el provider de la credencial del banco es `bice` y el código del catálogo es
 *  `bank_bice` — no son lo mismo. */
export const SOURCE_CODE_BY_ID: Record<OnboardingSourceId, string> = {
  sii: "sii_rcv",
  bank: "bank_bice",
};

export interface PendingBannerInput {
  /** Estado por fuente del adaptador del onboarding. */
  states: OnboardingSourceStates;
  /** No pudimos leer el status del onboarding (cargando o error). */
  isUnknown: boolean;
  /** El backend confirmó el onboarding completado. */
  completed: boolean;
  /** Estado canónico de las fuentes (`GET /api/sources/status`). */
  sources: SourceStatus[] | undefined;
  /** No pudimos leer el estado canónico (cargando o error). */
  sourcesUnknown: boolean;
  /** El usuario cerró el banner en esta sesión de navegación. */
  dismissed: boolean;
}

export type PendingBannerDecision =
  | { mostrar: false }
  | { mostrar: true; sources: OnboardingSourceId[] };

/** ¿Se muestra el banner, y por cuáles fuentes? */
export function pendingConnectionsBanner(input: PendingBannerInput): PendingBannerDecision {
  if (input.dismissed) return { mostrar: false };
  // Sin onboarding completado el guard ya lleva al wizard: el banner sobraría.
  if (input.isUnknown || !input.completed) return { mostrar: false };
  // Sin el estado canónico no podemos distinguir "sin conectar" de "conectada
  // con un problema" → callar es honesto; inventar no.
  if (input.sourcesUnknown || !input.sources) return { mostrar: false };

  const stateByCode = new Map(input.sources.map((s) => [s.source, s.state]));
  const faltantes = ONBOARDING_SOURCE_IDS.filter((id) => {
    if (input.states[id] === "connected") return false;
    // La fuente no vino en la respuesta: no sabemos si nunca se configuró o si
    // el backend no la conoce con ese código. No afirmamos.
    return stateByCode.get(SOURCE_CODE_BY_ID[id]) === "missing";
  });

  return faltantes.length > 0 ? { mostrar: true, sources: faltantes } : { mostrar: false };
}
