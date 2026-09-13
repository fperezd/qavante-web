/* V01 · Mientras no estabas — adaptación PURA de la bitácora de Ley 5 (issue #65).
 *
 * La fuente es `GET /api/reversible-actions`: el contrato garantiza que contiene sólo acciones
 * automáticas de Qavante, ordenadas desde la más reciente. No se mezcla con sync ni con clics del
 * dueño. `only_undoable=true` acota la vista a la ventana vigente; aun así, cada fila vuelve a
 * revisar `undo_available`, porque el backend puede detectar un estado derivado entre el listado
 * y el render. */

import type { ReversibleActionsListResponse } from "@/lib/api/reversible-actions";
import { formatDateLike } from "@/lib/formatters/date";

export interface ActividadAutomatica {
  actionId: string;
  resumen: string;
  creadaEn: string;
  venceEn: string;
  deshacerDisponible: boolean;
  deshacerResultado: string | null;
}

const RESUMEN_NEUTRO: Record<string, string> = {
  "bank_movement.auto_classify": "Qavante clasificó un movimiento automáticamente.",
  "receivable.mark_ceded": "Qavante registró una cesión informada.",
  "payable.postpone": "Se registró una postergación de pago.",
};

function etiquetaSegura(value: string): string | null {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * El backend aún entrega el detalle de negocio dentro de un resumen humano. Sólo aceptamos las
 * tres formas contractuales, ancladas de principio a fin: así conservamos el dato que permite
 * identificar qué se va a deshacer sin volver a imprimir texto histórico libre.
 */
function resumenSeguro(actionType: string, summary: string): string {
  if (actionType === "payable.postpone") {
    const match =
      /^Postergamos (7|15|30) días el pago a (.+): vencía el (\d{4}-\d{2}-\d{2}) y ahora vence el (\d{4}-\d{2}-\d{2})$/.exec(
        summary,
      );
    const supplier = match ? etiquetaSegura(match[2]!) : null;
    if (match && supplier) {
      return `Se postergó ${match[1]} días el pago a ${supplier}: del ${formatDateLike(match[3])} al ${formatDateLike(match[4])}.`;
    }
  }

  if (actionType === "receivable.mark_ceded") {
    const match =
      /^Marcamos una factura como cedida a ([0-9.Kk-]+) con fecha (\d{4}-\d{2}-\d{2}) \(la cobra el factor, no la empresa\)$/.exec(
        summary,
      );
    if (match) {
      return `Se registró una factura cedida a ${match[1]} el ${formatDateLike(match[2])}.`;
    }
  }

  if (actionType === "bank_movement.auto_classify") {
    const byRule = /^Clasificamos un movimiento con la regla '(.+)'$/.exec(summary);
    const rule = byRule ? etiquetaSegura(byRule[1]!) : null;
    if (rule) return `Qavante clasificó un movimiento con la regla “${rule}”.`;
    if (summary === "Clasificamos un movimiento desde el documento con el que quedó conciliado") {
      return "Qavante clasificó un movimiento desde su documento conciliado.";
    }
  }

  return RESUMEN_NEUTRO[actionType] ?? "Qavante registró una acción automática.";
}

/**
 * Convierte sólo lo que el contrato publicó. Los datos identificadores se extraen únicamente de
 * las formas contractuales conocidas; cualquier texto distinto cae en una descripción neutra.
 */
export function actividadesAutomaticas(
  response: ReversibleActionsListResponse | null | undefined,
  max: number,
): ActividadAutomatica[] {
  if (!response?.items) return [];
  return response.items.slice(0, max).map((item) => ({
    actionId: item.action_id,
    resumen: resumenSeguro(item.action_type, item.summary),
    creadaEn: item.created_at,
    venceEn: item.undo_expires_at,
    deshacerDisponible: item.undo_available,
    deshacerResultado: item.undo_result ?? null,
  }));
}
