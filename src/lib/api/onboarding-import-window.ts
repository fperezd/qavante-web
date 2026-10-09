import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/** Ventana mensual que el dueño elige antes de conectar SII y banco (mismo mes de corte). */
export type OnboardingImportWindow = components["schemas"]["OnboardingImportWindowResponse"];
export type OnboardingImportWindowRequest = components["schemas"]["OnboardingImportWindowRequest"];

export const onboardingImportWindowKeys = {
  window: ["onboarding", "import-window"] as const,
};

/** Un input `month` evita ofrecer días; al backend siempre llega el día 1. */
export function monthValue(date: string): string {
  return date.slice(0, 7);
}

export function startDateForMonth(month: string): string {
  return month ? `${month}-01` : "";
}

/** `GET /api/onboarding/import-window` — los límites vienen del registro real del tenant. */
export function useOnboardingImportWindow() {
  return useQuery({
    queryKey: onboardingImportWindowKeys.window,
    queryFn: () => api.get<OnboardingImportWindow>("/api/onboarding/import-window"),
    retry: false,
    staleTime: 30_000,
  });
}

/** `PUT /api/onboarding/import-window` — persiste el mes de corte para SII y Fintoc. */
export function useSetOnboardingImportWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingImportWindowRequest) =>
      api.put<OnboardingImportWindow>("/api/onboarding/import-window", { body }),
    onSuccess: (data) => qc.setQueryData(onboardingImportWindowKeys.window, data),
  });
}
