import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

/* Capa de datos — Consentimiento de fuentes (Tooxs360). Acceder a fuentes como
   el SII en nombre del tenant requiere un consentimiento legal explícito,
   separado de la credencial. Sin consentimiento válido, las consultas (ej. RCV
   del Libro de Ventas/Compras) devuelven 403 "consent missing".
   Endpoints (cookie de sesión, verificado 2026-06-28):
   - GET    /api/admin/sources/{code}/consent  → estado (válido o falta + texto)
   - POST   /api/admin/sources/{code}/consent  → aceptar
   - DELETE /api/admin/sources/{code}/consent  → revocar
   Tipos generados (regla 3). */

export type ConsentResponse = components["schemas"]["ConsentResponse"];
export type ConsentMissingResponse = components["schemas"]["ConsentMissingResponse"];
export type SourceConsentStatus = ConsentResponse | ConsentMissingResponse;
export type ConsentAcceptBody = components["schemas"]["ConsentAcceptRequest"];

export const sourceConsentKeys = {
  consent: (code: string) => ["source-consent", code] as const,
};

/** `GET /api/admin/sources/{code}/consent` — estado del consentimiento. Si falta,
    trae `consent_text_offered` (el texto a mostrar antes de aceptar). */
export function useSourceConsent(sourceCode: string, enabled = true) {
  return useQuery({
    queryKey: sourceConsentKeys.consent(sourceCode),
    queryFn: () => api.get<SourceConsentStatus>(`/api/admin/sources/${sourceCode}/consent`),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/admin/sources/{code}/consent` — acepta el consentimiento. Body
    opcional (si se omite, el backend usa el texto/versión estándar). Invalida el
    estado del consentimiento y el de fuentes. NO retry. */
export function useAcceptSourceConsent(sourceCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: ConsentAcceptBody) =>
      api.post<unknown>(`/api/admin/sources/${sourceCode}/consent`, { body: body ?? {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sourceConsentKeys.consent(sourceCode) });
      qc.invalidateQueries({ queryKey: ["sources-status"] });
    },
  });
}
