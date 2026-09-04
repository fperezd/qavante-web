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
import { cobranzaKeys } from "./cobranza";
import { pagosKeys } from "./pagos";
import type { components } from "./types";

export type ReviewQueueResponse = components["schemas"]["ReviewQueueResponse"];
export type MarkCollectedRequest = components["schemas"]["MarkCollectedRequest"];
export type MarkCollectedResponse = components["schemas"]["MarkCollectedResponse"];
export type RevertMarkCollectedResponse = components["schemas"]["RevertMarkCollectedResponse"];
export type ReviewItem = components["schemas"]["ReviewItem"];
export type ReviewSuggestion = components["schemas"]["ReviewSuggestion"];
export type SuggestionsResponse = components["schemas"]["SuggestionsResponse"];
export type CounterpartySuggestion = components["schemas"]["CounterpartySuggestion"];
export type DocumentSuggestion = components["schemas"]["DocumentSuggestion"];
export type DocumentSuggestionsResponse = components["schemas"]["DocumentSuggestionsResponse"];
export type ConfirmResponse = components["schemas"]["app__api__reconciliation__ConfirmResponse"];
export type ConfirmBatchResponse = components["schemas"]["ConfirmBatchResponse"];
export type ReconcileResponse = components["schemas"]["ReconcileResponse"];
export type ReanalyzeResponse = components["schemas"]["ReanalyzeResponse"];
export type ReconciliationAlias = components["schemas"]["ReconciliationAlias"];
export type ReconciliationAliasesResponse = components["schemas"]["ReconciliationAliasesResponse"];

/* API #359 todavía está en revisión y su schema no forma parte de `types.ts` en main.
 * Este response local replica exactamente el response_model publicado por ese PR. Al mergear
 * #359 se debe regenerar OpenAPI y reemplazar este alias por
 * `components["schemas"]["RejectDocumentSuggestionResponse"]`; no se edita el generado a mano. */
export interface RejectDocumentSuggestionResponse {
  movement_id: string;
  status: string;
  document_id: string;
}

export const reconciliationKeys = {
  all: ["reconciliation"] as const,
  review: () => [...reconciliationKeys.all, "review"] as const,
  suggestions: (movementId: string) =>
    [...reconciliationKeys.all, "suggestions", movementId] as const,
  aliases: () => [...reconciliationKeys.all, "aliases"] as const,
  documentSuggestions: (movementId: string) =>
    [...reconciliationKeys.all, "document-suggestions", movementId] as const,
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

/** Diccionario de aliases ya aprendido por confirmaciones humanas. Sólo lectura. */
export function useReconciliationAliases(enabled = true) {
  return useQuery({
    queryKey: reconciliationKeys.aliases(),
    queryFn: () => api.get<ReconciliationAliasesResponse>("/api/treasury/reconciliation/aliases"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Documentos candidatos para una elección humana explícita. Nunca confirma ni auto-aplica. */
export function useDocumentSuggestions(movementId: string | null, enabled = true) {
  return useQuery({
    queryKey: reconciliationKeys.documentSuggestions(movementId ?? ""),
    queryFn: () =>
      api.get<DocumentSuggestionsResponse>(
        `/api/treasury/reconciliation/${encodeURIComponent(movementId as string)}/document-suggestions`,
      ),
    enabled: enabled && movementId != null,
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

/** Confirma contra el documento que el usuario eligió de forma deliberada en la cola. */
export function useConfirmReconciliationWithDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, documentId }: { movementId: string; documentId: string }) =>
      api.post<ConfirmResponse>(
        `/api/treasury/reconciliation/${encodeURIComponent(movementId)}/confirm`,
        { body: { document_id: documentId } },
      ),
    onSuccess: (_result, { movementId }) => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.review() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.documentSuggestions(movementId) });
    },
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

export interface RejectReconciliationSuggestionInput {
  movementId: string;
  /** `null` conserva el descarte genérico de una sugerencia vieja sin documento identificable. */
  documentId: string | null;
}

/** Ejecuta el descarte más específico que el contrato permite.
 *
 * Con documento, API #359 guarda el par negativo movimiento-documento para que el motor no lo
 * proponga otra vez. Sin documento se conserva el `reject` histórico: no inventamos una memoria
 * cuyo identificador no conocemos. Exportada sin React para probar ruta, fallback y propagación
 * de errores sin un arés de hooks. */
export function rejectReconciliationSuggestion({
  movementId,
  documentId,
}: RejectReconciliationSuggestionInput): Promise<
  ConfirmResponse | RejectDocumentSuggestionResponse
> {
  const movement = encodeURIComponent(movementId);
  if (documentId) {
    return api.post<RejectDocumentSuggestionResponse>(
      `/api/treasury/reconciliation/${movement}/document-suggestions/${encodeURIComponent(documentId)}/reject`,
    );
  }
  return api.post<ConfirmResponse>(`/api/treasury/reconciliation/${movement}/reject`);
}

/** Igual que `useRejectReconciliation`, pero usa el rechazo con memoria cuando la card conoce el
 * documento. Invalida candidatos y cola en ambos caminos: el backend puede sacar el candidato
 * puntual o devolver el movimiento a `unmatched`. */
export function useRejectReconciliationSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectReconciliationSuggestion,
    onSuccess: (_result, { movementId }) => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.review() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.documentSuggestions(movementId) });
    },
  });
}

export type RevertReconciliationResponse = components["schemas"]["RevertReconciliationResponse"];

/** `POST /api/treasury/reconciliation/{movement_id}/revert` — DESASIGNA un match YA APLICADO
 *  (auto >=90 o confirmado): restaura el `outstanding` del/los documento(s), los vuelve a
 *  `open`/`partially_paid`, libera el movimiento (`unmatched`) y borra el registro. Idempotente
 *  (`reverted: 0` si no había match).
 *
 *  NO es `reject`: aquél descarta una sugerencia que todavía no se aplicó. Éste es el "Deshacer"
 *  de la Ley 5 para una conciliación hecha, y es el único de las dos cartas de la bandeja que
 *  existe hoy en el contrato deployado. Reabrir documentos cambia Cobrar y Pagar → misma
 *  invalidación que `mark-collected`. */
export function useRevertReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) =>
      api.post<RevertReconciliationResponse>(
        `/api/treasury/reconciliation/${encodeURIComponent(movementId)}/revert`,
      ),
    onSuccess: () => invalidarPorConciliar(qc),
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
    onSuccess: () => invalidarPorConciliar(qc),
  });
}

/* Conciliar/desconciliar un cobro/pago cambia las listas de Cobrar (AR) y Pagar (AP) y la cola de
   conciliación. NO invalidamos la proyección de caja (cash-projection): el por-cobrar-vencido está
   EXCLUIDO del runway, así que marcar no mueve los días de caja — y refrescarla sacaría el documento
   de la lista de Caja, rompiendo el "Conciliado ✓ · Deshacer" en su lugar (#851). */
function invalidarPorConciliar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: cobranzaKeys.all });
  qc.invalidateQueries({ queryKey: pagosKeys.all });
  qc.invalidateQueries({ queryKey: reconciliationKeys.review() });
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
    onSuccess: () => invalidarPorConciliar(qc),
  });
}

/** `POST /api/treasury/reconciliation/reanalyze` — RE-ANALIZA todo: resetea a `unmatched` las
 *  sugerencias sin confirmar y vuelve a correr el motor con el scorer y los aliases ACTUALES.
 *
 *  Distinto de `useRunReconcile`: el motor normal sólo mira lo `unmatched`, así que una sugerencia
 *  vieja queda "pegajosa" en la cola aunque el matcher haya mejorado o se hayan purgado aliases.
 *  Esto la limpia. Las conciliaciones CONFIRMADAS no se tocan — sólo las sugerencias pendientes.
 *
 *  Invalida la cola y los aliases: ambos cambian tras un re-análisis. */
export function useReanalyzeReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ReanalyzeResponse>("/api/treasury/reconciliation/reanalyze"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.review() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.aliases() });
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
