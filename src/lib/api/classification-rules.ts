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
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type ClassificationRule = components["schemas"]["ClassificationRule"];
export type ClassificationRulesResponse = components["schemas"]["ClassificationRulesResponse"];
export type CreateClassificationRuleRequest =
  components["schemas"]["CreateClassificationRuleRequest"];
export type UpdateClassificationRuleRequest =
  components["schemas"]["UpdateClassificationRuleRequest"];

/* Sugerencia de CATEGORÍA (no de regla-de-glosa) para un movimiento: el backend aplica sus reglas
   activas y devuelve la cuenta de gestión que correspondería (read-only, #794-4). Reemplaza en el
   drawer al viejo banner de "crear una regla" — Fernando: "esas reglas ya no se sugerirían, debería
   sugerir la clasificación a algo ya creado". `suggestion=null` si ninguna regla matchea (no inventa).
   Tipos GENERADOS (regla 3). */
export type SuggestedCategoryResponse = components["schemas"]["SuggestedCategoryResponse"];
export type SuggestedCategory = components["schemas"]["SuggestedCategory"];

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
  suggestedCategory: (movementId: string) =>
    [...classificationRulesKeys.all, "suggested-category", movementId] as const,
};

/* Crear/editar/toggle de una regla cambia cómo se (re)clasifican los
   movimientos server-side y, vía su `management_account_id`, los
   financial_impacts que alimentan el cash-flow report. Esos viven en los
   namespaces `treasury` y `treasury-reports`, que NO son prefijo de
   `classification-rules` → hay que invalidarlos aparte. Espejo del
   cross-invalidation de `classify` (treasury.ts). Se usan las keys raíz
   LITERALES (== `treasuryKeys.all` / `treasuryReportsKeys.all`) para evitar un
   import circular: treasury.ts ya importa `classificationRulesKeys` de acá. */
function invalidateAfterRuleChange(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: classificationRulesKeys.all });
  qc.invalidateQueries({ queryKey: ["treasury"] });
  qc.invalidateQueries({ queryKey: ["treasury-reports"] });
}

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
    onSuccess: () => invalidateAfterRuleChange(qc),
  });
}

/** `PATCH /api/treasury/classification-rules/{id}` — edición parcial. */
export function useUpdateClassificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: UpdateClassificationRuleRequest }) =>
      api.patch<ClassificationRule>(`/api/treasury/classification-rules/${ruleId}`, { body }),
    onSuccess: () => invalidateAfterRuleChange(qc),
  });
}

/** `POST /api/treasury/classification-rules/{id}/toggle-active` — invierte
 *  el flag `active` (§17.5: las reglas NO se borran, se desactivan). */
export function useToggleClassificationRuleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      api.post<ClassificationRule>(`/api/treasury/classification-rules/${ruleId}/toggle-active`),
    onSuccess: () => invalidateAfterRuleChange(qc),
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

/** `GET /api/treasury/bank-movements/{movement_id}/suggested-category` — read-only: la CUENTA de
 *  gestión que las reglas activas asignarían a este movimiento (#794-4). Alimenta el banner
 *  "Sugerido: <cuenta> · Clasificar" del drawer. NO retry (404 si el movimiento no existe); solo
 *  corre con `movementId` no vacío. `data.suggestion` es null si ninguna regla matchea. */
export function useSuggestedCategory(movementId: string) {
  return useQuery({
    queryKey: classificationRulesKeys.suggestedCategory(movementId),
    queryFn: () =>
      api.get<SuggestedCategoryResponse>(
        `/api/treasury/bank-movements/${encodeURIComponent(movementId)}/suggested-category`,
      ),
    enabled: movementId !== "",
    staleTime: 30_000,
    retry: false,
  });
}
