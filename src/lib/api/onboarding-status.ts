import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — estado del onboarding. Sprint onboarding.

   status + complete YA están en prod (2026-06-22) → tipos GENERADOS. `sync`
   (wrapper de /bice/sync + /sii/sync-rcv) AÚN no existe → FE-first. Gated por
   `onboarding`. Ver `docs/backend-contracts/onboarding-status-contract.md`. */

/* ── Estado del onboarding (para el guard) ───────────────────────────────── */

/** `OnboardingStatusResponse` real: `{ completed, completed_at?, steps?:
    { sii_connected, bank_connected } }`. (No trae `current_step`.) */
export type OnboardingStatus = components["schemas"]["OnboardingStatusResponse"];

/** `GET /api/onboarding/status` — estado del onboarding del tenant. NO retry. */
export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => api.get<OnboardingStatus>("/api/onboarding/status"),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

/* ── Completar onboarding ────────────────────────────────────────────────── */

/** `POST /api/onboarding/complete` — marca el onboarding completado (owner/admin,
    idempotente). Devuelve el status actualizado. NO retry. */
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: () => api.post<OnboardingStatus>("/api/onboarding/complete"),
  });
}

/* ── Traer datos (sync inicial) — FE-first: wrapper aún no existe ─────────── */

export interface OnboardingSyncResponse {
  started: boolean;
}

/** `POST /api/onboarding/sync` — dispara la traída inicial (SII + banco). NO retry. */
export function useTriggerOnboardingSync() {
  return useMutation({
    mutationFn: () => api.post<OnboardingSyncResponse>("/api/onboarding/sync"),
  });
}
