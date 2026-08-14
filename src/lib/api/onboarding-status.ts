import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — estado del onboarding. Sprint onboarding.

   status + complete + sync YA están en prod (2026-06-22, qavante-api #344/#345)
   → tipos GENERADOS. `sync` es per-source partial-success:
   `{ sources: { sii: { status }, bank: { status } } }` con status
   ok|failed|skipped. Gated por `onboarding`. */

/* ── Estado del onboarding (para el guard) ───────────────────────────────── */

/** `OnboardingStatusResponse` real: `{ completed, completed_at?, steps?:
    { sii_connected, bank_connected } }`. (No trae `current_step`.) */
export type OnboardingStatus = components["schemas"]["OnboardingStatusResponse"];

/** Clave de cache del estado del onboarding. UNA sola definición: el guard, el
 *  hub, el banner y los pasos del wizard leen la MISMA entrada del `QueryClient`
 *  (que es único para toda la app — vive en el layout raíz, `app-providers.tsx`).
 *  Escribir la clave literal en otro archivo es como se coló el bug de cache que
 *  devolvía al wizard al usuario que acababa de terminarlo. */
export const onboardingStatusKeys = {
  status: ["onboarding", "status"] as const,
};

/** Opciones de la query del status. Exportadas para que el test de regresión
 *  observe EXACTAMENTE la misma query que el guard (misma clave, mismo
 *  `staleTime`), sin re-declararla y sin que se pueda desincronizar. */
export function onboardingStatusQueryOptions() {
  return {
    queryKey: onboardingStatusKeys.status,
    queryFn: () => api.get<OnboardingStatus>("/api/onboarding/status"),
    retry: false,
    staleTime: 30_000,
  };
}

/** `GET /api/onboarding/status` — estado del onboarding del tenant. NO retry. */
export function useOnboardingStatus(enabled = true) {
  return useQuery({ ...onboardingStatusQueryOptions(), enabled });
}

/* ── Completar onboarding ────────────────────────────────────────────────── */

/** ¿La respuesta tiene forma de `OnboardingStatusResponse`? Solo escribimos en
 *  la cache lo que de verdad es un status: un body inesperado (204, proxy raro)
 *  NO puede quedar guardado como si fuera el estado del tenant. */
export function isOnboardingStatus(data: unknown): data is OnboardingStatus {
  return typeof (data as OnboardingStatus | undefined)?.completed === "boolean";
}

/** Escribe en la cache el status que devolvió el backend; si la respuesta no
 *  sirve, invalida para que el próximo lector vaya a buscar la verdad.
 *  Exportada para el test de regresión del cierre del wizard. */
export function applyOnboardingStatus(qc: QueryClient, data: unknown): void {
  if (isOnboardingStatus(data)) {
    qc.setQueryData(onboardingStatusKeys.status, data);
    return;
  }
  void qc.invalidateQueries({ queryKey: onboardingStatusKeys.status });
}

/** `POST /api/onboarding/complete` — marca el onboarding completado (owner/admin,
    idempotente). Devuelve el status actualizado. NO retry.

    ⚠️ REGRESIÓN CAZADA EN REVIEW (PR #935): esta mutación DEBE escribir el status
    devuelto en `["onboarding","status"]`. El `QueryClient` es único para toda la
    app, así que la entrada que dejaron los pasos del wizard (`completed:false`)
    sobrevive a la navegación al panel; si no la pisamos, el `OnboardingGuard` la
    lee en su primer render (0 fetches) y devuelve al wizard al usuario que ACABA
    de terminarlo. Cubierto por `onboarding-complete-cache.test.ts`. */
export function completeOnboardingMutationOptions(qc: QueryClient) {
  return {
    mutationFn: () => api.post<OnboardingStatus>("/api/onboarding/complete"),
    // Corre ANTES del `onSuccess`/`onSettled` del llamador (react-query v5), o
    // sea antes de que la vista navegue al panel: el guard ya lee la verdad nueva.
    onSuccess: (data: OnboardingStatus) => applyOnboardingStatus(qc, data),
    // Si falló no sabemos en qué quedó el backend → que el próximo lector
    // refetchee, en vez de confiar en el dato viejo.
    onError: () => void qc.invalidateQueries({ queryKey: onboardingStatusKeys.status }),
  };
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation(completeOnboardingMutationOptions(qc));
}

/* ── Traer datos (sync inicial) — per-source partial-success ──────────────── */

/** `OnboardingSyncResponse` real: `{ sources: { sii: { status }, bank: { status } } }`
    con status `ok` | `failed` | `skipped` (no conectada). */
export type OnboardingSyncResponse = components["schemas"]["OnboardingSyncResponse"];

/** `POST /api/onboarding/sync` — dispara la traída inicial (SII + banco). NO retry.
 *
 *  El sync cambia el estado de las fuentes (y con él los pasos del wizard), así
 *  que al terminar invalidamos el status: sin esto el hub y el banner siguen
 *  mostrando el estado previo por hasta 30 s. */
export function useTriggerOnboardingSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<OnboardingSyncResponse>("/api/onboarding/sync"),
    onSettled: () => void qc.invalidateQueries({ queryKey: onboardingStatusKeys.status }),
  });
}
