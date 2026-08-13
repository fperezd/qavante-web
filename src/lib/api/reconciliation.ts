/* Capa de datos — Conciliación (cola de revisión, ADR-0036/0042).
 *
 * El motor (`POST /api/treasury/reconcile`) auto-aplica los matches con score >=90, deja los de
 * 60-90 en una COLA DE REVISIÓN y no toca el resto. Esta capa cablea esa cola: listar, confirmar
 * (aplica el match; parcial si el monto difiere), rechazar (devuelve el movimiento a 'unmatched')
 * y confirmar en lote ("Conciliar todas").
 *
 * Semántica verificada en qavante-api (`core/reconciliation.py`):
 *   - confirm_review: |diff|<=ε tolerancia · diff>ε parcial (partially_paid) · exacto si calza.
 *   - reject_review:  bank_movements.reconciliation_status = 'unmatched' (no re-encola).
 *
 * Tipos del OpenAPI generado (`./types`), NUNCA hand-rolled (regla 3). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { treasuryKeys } from "./treasury";
import type { components } from "./types";

export type ReviewQueueResponse = components["schemas"]["ReviewQueueResponse"];
export type MarkCollectedRequest = components["schemas"]["MarkCollectedRequest"];
export type MarkCollectedResponse = components["schemas"]["MarkCollectedResponse"];
export type RevertMarkCollectedResponse = components["schemas"]["RevertMarkCollectedResponse"];
export type ReviewItem = components["schemas"]["ReviewItem"];
export type ReviewSuggestion = components["schemas"]["ReviewSuggestion"];
export type SuggestionsResponse = components["schemas"]["SuggestionsResponse"];
export type CounterpartySuggestion = components["schemas"]["CounterpartySuggestion"];
export type ConfirmResponse = components["schemas"]["app__api__reconciliation__ConfirmResponse"];
export type ConfirmBatchResponse = components["schemas"]["ConfirmBatchResponse"];
export type ReconcileResponse = components["schemas"]["ReconcileResponse"];

export const reconciliationKeys = {
  all: ["reconciliation"] as const,
  review: () => [...reconciliationKeys.all, "review"] as const,
  suggestions: (movementId: string) =>
    [...reconciliationKeys.all, "suggestions", movementId] as const,
};

/** `GET /api/treasury/reconciliation/review` — cola de revisión: movimientos con una sugerencia
 *  de match de confianza media (score 60-90) esperando confirmación. */
export function useReconciliationReview(enabled = true) {
  return useQuery({
    queryKey: reconciliationKeys.review(),
    queryFn: () => api.get<ReviewQueueResponse>("/api/treasury/reconciliation/review"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `GET /api/treasury/reconciliation/{movement_id}/suggestions` — top-5 contrapartes probables
 *  (read-only, NO auto-aplica). Para el drill-down cuando la sugerencia en cola no convence. */
export function useMovementSuggestions(movementId: string | null) {
  return useQuery({
    queryKey: reconciliationKeys.suggestions(movementId ?? ""),
    queryFn: () =>
      api.get<SuggestionsResponse>(
        `/api/treasury/reconciliation/${encodeURIComponent(movementId as string)}/suggestions`,
      ),
    enabled: movementId != null,
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/treasury/reconciliation/{movement_id}/confirm` — confirma la sugerencia en cola. */
export function useConfirmReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) =>
      api.post<ConfirmResponse>(
        `/api/treasury/reconciliation/${encodeURIComponent(movementId)}/confirm`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: reconciliationKeys.review() }),
  });
}

/** `POST /api/treasury/reconciliation/{movement_id}/reject` — descarta la sugerencia; el
 *  movimiento vuelve a 'unmatched' (no se re-encola). */
export function useRejectReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) =>
      api.post<ConfirmResponse>(
        `/api/treasury/reconciliation/${encodeURIComponent(movementId)}/reject`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: reconciliationKeys.review() }),
  });
}

/** `POST /api/treasury/reconciliation/confirm-batch` — "Conciliar todas (N)". Best-effort: cada
 *  movimiento se confirma por separado; devuelve cuántos confirmaron y cuántos fallaron. */
export function useConfirmReconciliationBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementIds: string[]) =>
      api.post<ConfirmBatchResponse>("/api/treasury/reconciliation/confirm-batch", {
        body: { movement_ids: movementIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: reconciliationKeys.review() }),
  });
}

/** `POST /api/treasury/reconciliation/mark-collected` — concilia cobros/pagos POR DOCUMENTO desde Caja
 *  (la plata ya entró/salió, sacamos el doc de "por cobrar/pagar"): `{ source_external_ids, side }`.
 *  Reversible (`.../mark-collected/revert`) e idempotente (0 si ya estaban pagados). Al conciliar
 *  cambia el por-cobrar-vencido y el runway → invalidamos tesorería (cash-projection) para refrescar. */
export function useMarkCollected() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MarkCollectedRequest) =>
      api.post<MarkCollectedResponse>("/api/treasury/reconciliation/mark-collected", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      qc.invalidateQueries({ queryKey: reconciliationKeys.review() });
    },
  });
}

/** `POST /api/treasury/reconciliation/mark-collected/revert` — DESHACE un `mark-collected`: re-abre los
 *  documentos (vuelven a "por cobrar"). Mismo body que mark-collected. Es la red de seguridad del
 *  "Deshacer" (#851): si el dueño marca un cobro por error, lo devuelve de un clic. Invalida tesorería. */
export function useMarkCollectedRevert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MarkCollectedRequest) =>
      api.post<RevertMarkCollectedResponse>("/api/treasury/reconciliation/mark-collected/revert", {
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      qc.invalidateQueries({ queryKey: reconciliationKeys.review() });
    },
  });
}

/** `POST /api/treasury/reconcile` — corre el motor sobre los movimientos sin conciliar. Idempotente:
 *  auto-aplica los matches con score >=90 y deja los 60-90 en la cola. Refresca la cola al terminar
 *  (los nuevos a revisar aparecen solos). No tiene body. */
export function useRunReconcile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ReconcileResponse>("/api/treasury/reconcile"),
    onSuccess: () => qc.invalidateQueries({ queryKey: reconciliationKeys.review() }),
  });
}
