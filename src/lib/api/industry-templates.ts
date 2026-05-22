/* Capa de datos — Industry Templates: catálogo global de plantillas por
 * rubro + apply al tenant (Addendum §13.5/§13.6/§14.1/§14.2).
 *
 * Endpoints contractuales (verificados live 2026-05-21):
 * - `GET  /api/management/industry-templates`            → catálogo global.
 * - `GET  /api/management/industry-templates/{code}`     → plantilla detail
 *      (template + dimensions + accounts sugeridas).
 * - `POST /api/management/industry-templates/{code}/apply` → §14.1/§14.2:
 *      - `mode='suggest_only'`       → preview diff, NO escribe (default).
 *      - `mode='add_missing'`        → crea dims faltantes (cuentas siempre
 *                                       son report-only, dominio de A §6.2).
 *      - `mode='replace_visibility'` → ajusta visibilidad de dims existentes.
 *      NUNCA borra ni pisa datos (§14.1 — sin modo destructivo).
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). El
 * gating de la UI lo hace `industryTemplates` (ADR-0008) en su PR de wire. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type IndustryTemplate = components["schemas"]["IndustryTemplate"];
export type IndustryTemplatesListResponse = components["schemas"]["IndustryTemplatesListResponse"];
export type IndustryTemplateDetail = components["schemas"]["IndustryTemplateDetail"];
export type IndustryTemplateDimension = components["schemas"]["IndustryTemplateDimension"];
export type IndustryTemplateAccount = components["schemas"]["IndustryTemplateAccount"];
export type ApplyTemplateRequest = components["schemas"]["ApplyTemplateRequest"];
export type ApplyTemplateResponse = components["schemas"]["ApplyTemplateResponse"];
export type ApplyTemplateSummary = components["schemas"]["ApplyTemplateSummary"];

export const industryTemplatesKeys = {
  all: ["industry-templates"] as const,
  list: () => [...industryTemplatesKeys.all, "list"] as const,
  detail: (templateCode: string) => [...industryTemplatesKeys.all, "detail", templateCode] as const,
};

/** `GET /api/management/industry-templates` — catálogo casi-estático
 *  (sólo cambia cuando se agregan rubros). staleTime alto. */
export function useIndustryTemplates() {
  return useQuery({
    queryKey: industryTemplatesKeys.list(),
    queryFn: () => api.get<IndustryTemplatesListResponse>("/api/management/industry-templates"),
    staleTime: 60 * 60 * 1000, // 1 h
    retry: false,
  });
}

/** `GET /api/management/industry-templates/{code}` — detail con
 *  dimensions + accounts sugeridas. `enabled` evita disparar con código
 *  vacío (drawer/dialog no abierto todavía). */
export function useIndustryTemplate(templateCode: string) {
  return useQuery({
    queryKey: industryTemplatesKeys.detail(templateCode),
    queryFn: () =>
      api.get<IndustryTemplateDetail>(`/api/management/industry-templates/${templateCode}`),
    enabled: templateCode !== "",
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** `POST /api/management/industry-templates/{code}/apply` — aplica la
 *  plantilla al tenant en el modo especificado (suggest_only / add_missing /
 *  replace_visibility). NUNCA destructivo (§14.1). Invalida management
 *  (accounts tree + dimensions) cuando el modo es escritura. */
export function useApplyIndustryTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateCode, body }: { templateCode: string; body: ApplyTemplateRequest }) =>
      api.post<ApplyTemplateResponse>(`/api/management/industry-templates/${templateCode}/apply`, {
        body,
      }),
    onSuccess: (data) => {
      /* Modo suggest_only NO escribe → no invalida nada (preview puro). */
      if (data.mode !== "suggest_only") {
        qc.invalidateQueries({ queryKey: ["management"] });
      }
    },
  });
}
