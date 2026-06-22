import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";

/* Capa de datos — estado del onboarding (traer datos / completar / status).
   Sprint onboarding. ⚠️ Contrato FE-FIRST: estos endpoints AÚN NO existen en
   prod. Ver `docs/backend-contracts/onboarding-status-contract.md`. Gated por
   `onboarding`. */

/* ── Traer datos (sync inicial) ──────────────────────────────────────────── */

export interface OnboardingSyncResponse {
  /** El backend disparó la sincronización inicial (SII + banco). Puede ser
      asíncrona: el FE muestra progreso y permite continuar igual. */
  started: boolean;
}

/** `POST /api/onboarding/sync` — dispara la traída inicial de datos (SII + banco)
    tras conectar las fuentes. NO retry. */
export function useTriggerOnboardingSync() {
  return useMutation({
    mutationFn: () => api.post<OnboardingSyncResponse>("/api/onboarding/sync"),
  });
}

/* ── Completar onboarding ────────────────────────────────────────────────── */

export interface CompleteOnboardingResponse {
  completed: boolean;
}

/** `POST /api/onboarding/complete` — marca el onboarding como completado para el
    tenant (el guard deja de mandar al wizard). NO retry. */
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: () => api.post<CompleteOnboardingResponse>("/api/onboarding/complete"),
  });
}

/* ── Estado del onboarding (para el guard) ───────────────────────────────── */

export interface OnboardingStatus {
  /** true si el tenant ya completó el onboarding. */
  completed: boolean;
  /** Paso actual sugerido por el backend (id de OnboardingStep) si está incompleto. */
  current_step?: string | null;
}

/** `GET /api/onboarding/status` — estado del onboarding del tenant. El guard lo
    usa para decidir si manda al wizard. FE-first (aún no existe). */
export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => api.get<OnboardingStatus>("/api/onboarding/status"),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
