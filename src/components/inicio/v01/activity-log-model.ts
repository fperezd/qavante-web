/* V01 · Mientras no estabas — adaptación PURA de la bitácora de Ley 5 (issue #65).
 *
 * La fuente es `GET /api/reversible-actions`: el contrato garantiza que contiene sólo acciones
 * automáticas de Qavante, ordenadas desde la más reciente. No se mezcla con sync ni con clics del
 * dueño. `only_undoable=true` acota la vista a la ventana vigente; aun así, cada fila vuelve a
 * revisar `undo_available`, porque el backend puede detectar un estado derivado entre el listado
 * y el render. */

import type { ReversibleActionsListResponse } from "@/lib/api/reversible-actions";

export interface ActividadAutomatica {
  actionId: string;
  resumen: string;
  creadaEn: string;
  venceEn: string;
  deshacerDisponible: boolean;
  deshacerResultado: string | null;
}

/** Convierte sólo lo que el contrato publicó. No inventa entradas ni reordena el servidor. */
export function actividadesAutomaticas(
  response: ReversibleActionsListResponse | null | undefined,
  max: number,
): ActividadAutomatica[] {
  if (!response?.items) return [];
  return response.items.slice(0, max).map((item) => ({
    actionId: item.action_id,
    resumen: item.summary,
    creadaEn: item.created_at,
    venceEn: item.undo_expires_at,
    deshacerDisponible: item.undo_available,
    deshacerResultado: item.undo_result ?? null,
  }));
}
