/* Capa de datos — Classification Rules: reglas de clasificación automática
 * de movimientos bancarios (Addendum §17.5/§17.6/§18.7).
 *
 * Endpoints contractuales (verificados live 2026-05-21):
 * - `GET    /api/treasury/classification-rules`               → lista (priority ASC).
 * - `POST   /api/treasury/classification-rules`               → crear regla.
 * - `PATCH  /api/treasury/classification-rules/{id}`          → editar parcial.
 * - `POST   /api/treasury/classification-rules/{id}/toggle-active` → activa/desactiva
 *      (§17.5: toda regla debe ser desactivable, NO se borra).
 * - `POST   /api/bank-movements/{movement_id}/suggest-rule`   → sugiere regla
 *      derivada del movimiento (read-only, no persiste; §18.7).
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). El
 * gating de la UI lo hace `classificationRules` (ADR-0008) en su PR de wire. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type ClassificationRule = components["schemas"]["ClassificationRule"];
export type ClassificationRulesResponse = components["schemas"]["ClassificationRulesResponse"];
export type CreateClassificationRuleRequest =
  components["schemas"]["CreateClassificationRuleRequest"];
export type UpdateClassificationRuleRequest =
  components["schemas"]["UpdateClassificationRuleRequest"];

/* `/suggest-rule` devuelve un objeto opaco (additionalProperties=true en el
   OpenAPI). El shape estable que el FE consume es el subset documentado en
   §18.7 — name + condition_field + operator + condition_value (sugerencia).
   Los demás campos se completan al `POST /classification-rules` después. */
export interface SuggestRuleResponse {
  name?: string;
  source_type?: string;
  condition_field?: string;
  operator?: string;
  condition_value?: string;
  /* Forward-compat: el backend puede agregar más campos derivados. */
  [key: string]: unknown;
}

export const classificationRulesKeys = {
  all: ["classification-rules"] as const,
  list: () => [...classificationRulesKeys.all, "list"] as const,
  suggestForMovement: (movementId: string) =>
    [...classificationRulesKeys.all, "suggest", movementId] as const,
};

/** `GET /api/treasury/classification-rules` — lista ordenada por priority ASC. */
export function useClassificationRules() {
  return useQuery({
    queryKey: classificationRulesKeys.list(),
    queryFn: () => api.get<ClassificationRulesResponse>("/api/treasury/classification-rules"),
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/treasury/classification-rules` — crear regla. 403 si
 *  role !owner/admin (§20); 404 si management_account_id no existe;
 *  422 si dominio inválido. Invalida el listado al éxito. */
export function useCreateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClassificationRuleRequest) =>
      api.post<ClassificationRule>("/api/treasury/classification-rules", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: classificationRulesKeys.all }),
  });
}

/** `PATCH /api/treasury/classification-rules/{id}` — edición parcial. */
export function useUpdateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: UpdateClassificationRuleRequest }) =>
      api.patch<ClassificationRule>(`/api/treasury/classification-rules/${ruleId}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: classificationRulesKeys.all }),
  });
}

/** `POST /api/treasury/classification-rules/{id}/toggle-active` — invierte
 *  el flag `active` (§17.5: las reglas NO se borran, se desactivan). */
export function useToggleClassificationRuleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      api.post<ClassificationRule>(`/api/treasury/classification-rules/${ruleId}/toggle-active`),
    onSuccess: () => qc.invalidateQueries({ queryKey: classificationRulesKeys.all }),
  });
}

/** `POST /api/bank-movements/{movement_id}/suggest-rule` — read-only,
 *  no persiste. Devuelve una sugerencia derivada del movimiento (§18.7).
 *  El usuario la confirma luego vía `useCreateClassificationRule`. */
export function useSuggestRuleForMovement() {
  return useMutation({
    mutationFn: (movementId: string) =>
      api.post<SuggestRuleResponse>(`/api/bank-movements/${movementId}/suggest-rule`),
  });
}
