import { useMutation, useQuery } from "@tanstack/react-query";
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

/* ── Traer datos (sync inicial) — per-source partial-success ──────────────── */

/** `OnboardingSyncResponse` real: `{ sources: { sii: { status }, bank: { status } } }`
    con status `ok` | `failed` | `skipped` (no conectada). */
export type OnboardingSyncResponse = components["schemas"]["OnboardingSyncResponse"];

/** `POST /api/onboarding/sync` — dispara la traída inicial (SII + banco). NO retry. */
export function useTriggerOnboardingSync() {
  return useMutation({
    mutationFn: () => api.post<OnboardingSyncResponse>("/api/onboarding/sync"),
  });
}
