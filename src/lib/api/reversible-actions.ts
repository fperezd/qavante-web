/* Capa de datos — Reversión genérica (ADR-0113, Ley 5), issue #253 → qavante-api#257 (mergeado
 * 2026-08-31, `44e75868`).
 *
 * UN patrón para "todo lo automático deja bitácora con Deshacer, 7 días": el backend registra
 * una fila en `audit.reversible_actions` cuando un AUTOMATISMO —nunca una decisión manual del
 * usuario— clasifica un movimiento o marca una cesión, y expone:
 *
 *   · GET  /api/reversible-actions                    → bitácora del tenant (Ley 5, sólo lectura).
 *   · POST /api/reversible-actions/{action_id}/revert  → la reversión, GENÉRICA para todo
 *     `action_type` (un solo endpoint, no uno por feature).
 *
 * VERIFICADO contra `api/app/core/reversible_actions.py` y `api/app/core/treasury_repo.py`
 * (`classify_movement`): `PATCH /api/bank-movements/{id}/classify` —el que dispara la carta de
 * clasificar de V07 al aceptar una sugerencia o elegir una categoría a mano, vía
 * `useClassifyBankMovement`— NUNCA pasa por acá. El compensador sólo se registra cuando
 * `classify_movement` recibe `auto_action_summary`, y ESO sólo lo pasan los dos automatismos
 * por LOTE: `apply_active_rules_to_unclassified_movements` (`POST .../apply-rules`) y
 * `classify_reconciled_movements` (`POST .../classify-reconciled`). El PATCH manual de pantalla
 * es una decisión del USUARIO, y la Ley 5 es explícita en el propio código: "cubre lo que
 * Qavante hace SOLO, no lo que el usuario decide". Por eso el botón "Guardar" de la carta de
 * clasificar sigue sin su propio Deshacer (correcto — no un hueco), y lo que sí se conecta acá
 * es la bitácora de lo que YA corrió automático en el tenant: sigue siendo relevante para
 * "clasificar" porque deshacer una auto-clasificación devuelve el movimiento a "sin clasificar",
 * o sea de vuelta a esa misma carta.
 *
 * Motivos finos de un `undo_not_supported` (`api/app/core/reversible_actions.py`,
 * `MOTIVO_ESTADO_DERIVADO` / `MOTIVO_ESTADO_BLOQUEADO`), verificados en el despachador:
 *   - `estado_derivado`  — el usuario reclasificó a mano DESPUÉS de la acción automática (o algo
 *     más cambió el estado). No se tocó nada: Deshacer le borraría su propio trabajo. NO es
 *     reintentable — no hay nada que arreglar reintentando.
 *   - `estado_bloqueado` — la fila está tomada por otra operación en ese instante (lock con
 *     timeout de 3 s). No se tocó nada. SÍ es reintentable.
 * Viajan en `detail`, que el contrato publica como `dict` libre (no amplía el `result` cerrado).
 * El texto humano en `detail.explicacion` lo escribe el backend para esto mismo — se usa tal
 * cual; un motivo que no sea ninguno de los dos NO se inventa (Ley 8, "no sé" explícito). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { treasuryKeys } from "./treasury";
import type { components } from "./types";

export type ReversibleActionItem = components["schemas"]["ReversibleActionItem"];
export type ReversibleActionsListResponse = components["schemas"]["ReversibleActionsListResponse"];
export type RevertActionResponse = components["schemas"]["RevertActionResponse"];

/** `action_type` de la auto-clasificación de movimientos bancarios (ADR-0113 §3.3.1) — el único
 *  que le importa a la carta de clasificar; el de cesión (`receivable.mark_ceded`) es de Cobrar. */
export const ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY = "bank_movement.auto_classify";

export interface ReversibleActionsParams {
  legalEntityId?: string;
  actionType?: string;
  onlyUndoable?: boolean;
  limit?: number;
  offset?: number;
}

export const reversibleActionsKeys = {
  all: ["reversible-actions"] as const,
  list: (params: ReversibleActionsParams) =>
    [...reversibleActionsKeys.all, "list", params] as const,
};

function buildQuery(p: ReversibleActionsParams): string {
  const s = new URLSearchParams();
  if (p.legalEntityId) s.set("legal_entity_id", p.legalEntityId);
  if (p.actionType) s.set("action_type", p.actionType);
  if (p.onlyUndoable) s.set("only_undoable", "true");
  if (p.limit != null) s.set("limit", String(p.limit));
  if (p.offset != null) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /api/reversible-actions` — bitácora de lo que Qavante hizo solo (Ley 5).
 *
 *  `onlyUndoable` filtra en el SERVER por `status='active' AND reversible AND expires_at > now()`,
 *  pero NO garantiza `undo_available: true` en cada ítem: el backend recién ahí relee el estado
 *  vivo por ítem y puede devolver `undo_available: false` con `undo_result: "undo_not_supported"`
 *  si derivó (verificado en `list_actions`, `app/core/reversible_actions.py`). El consumidor
 *  SIEMPRE tiene que leer el campo, nunca asumir del filtro. */
export function useReversibleActions(params: ReversibleActionsParams, enabled = true) {
  return useQuery({
    queryKey: reversibleActionsKeys.list(params),
    queryFn: () =>
      api.get<ReversibleActionsListResponse>(`/api/reversible-actions${buildQuery(params)}`),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** `POST /api/reversible-actions/{action_id}/revert` — la reversión GENÉRICA (ADR-0113).
 *
 *  El resultado nunca llega como excepción salvo 403 (sin rol de escritura) / 404 (acción de
 *  otro tenant o inexistente, mismo código para no filtrar existencia — INV-TENANT-001): un
 *  Deshacer que no procede responde 200 con `result: "undo_not_supported"` y el motivo fino en
 *  `detail.motivo`. Ese caso NO es un error de red ni de servidor — es información, y el
 *  consumidor tiene que leerla en vez de tratarla como fallo genérico. */
export function useRevertReversibleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) =>
      api.post<RevertActionResponse>(
        `/api/reversible-actions/${encodeURIComponent(actionId)}/revert`,
      ),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: reversibleActionsKeys.all });
      /* Sólo un `reverted` de verdad devolvió el movimiento a "sin clasificar" (y borró sus
         financial_impacts): recién ahí vale refrescar los listados de movimientos — para que
         reaparezca en la carta de clasificar. Los otros tres resultados no tocaron nada. */
      if (
        result.result === "reverted" &&
        result.action_type === ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY
      ) {
        qc.invalidateQueries({ queryKey: treasuryKeys.all });
      }
    },
  });
}
