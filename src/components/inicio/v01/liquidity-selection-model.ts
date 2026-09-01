import type { DecisionSelectionResponse } from "@/lib/api/financial-decisions";
import { ApiError } from "@/lib/api/errors";

export function selectionErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "No pudimos registrar la selección. Reintenta.";
  if (error.status === 401) return "Tu sesión venció. Vuelve a iniciar sesión para decidir.";
  if (error.status === 403) return "Tu rol no está autorizado para registrar esta decisión.";
  if (error.status === 409) {
    return "La decisión cambió, venció o ya tiene una selección. Actualiza Hoy antes de decidir.";
  }
  if (error.status === 422) {
    return "La alternativa ya no cumple las condiciones de la evaluación. Actualiza Hoy y revísala nuevamente.";
  }
  if (error.isNetworkError()) {
    return "No pudimos confirmar si la selección se registró. Reintenta sin cambiar el motivo.";
  }
  return "No pudimos registrar la selección. Reintenta.";
}

export function selectionSuccessMessage(result: DecisionSelectionResponse): string {
  if (result.replayed) return "Esta misma selección ya estaba registrada.";
  if (!result.operation_required) {
    return "Selección registrada. No requiere un plan operativo ni inicia financiamiento.";
  }
  return "Selección registrada. Qavante creó un plan operativo en borrador; todavía no se ejecuta.";
}
