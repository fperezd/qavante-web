import type { ActivityLogItem, ActivityLogSource } from "@/lib/api/activity-log";

export interface ActividadRegistrada {
  id: string;
  fuente: ActivityLogSource;
  etiquetaFuente: string;
  tipo: string;
  resumen: string;
  creadaEn: string;
  resultado: string | null;
}

const ETIQUETA_FUENTE: Record<ActivityLogSource, string> = {
  reversible_action: "Acción automática",
  audit_event: "Cambio registrado",
  sync_run: "Actualización de fuente",
};

const ETIQUETA_EVENTO: Record<string, string> = {
  "bank_movement.auto_classify": "Movimiento clasificado automáticamente",
  "bank_movement.classify": "Movimiento clasificado",
  "classification_rule.create": "Regla de clasificación creada",
  "collection.plan_created": "Plan de cobranza registrado",
  "sii.sync": "Información del SII actualizada",
};

const RESUMEN_FUENTE: Record<ActivityLogSource, string> = {
  reversible_action: "Se registró una acción automática.",
  audit_event: "Se registró un cambio.",
  sync_run: "Se registró una actualización de una fuente.",
};

const RESULTADO: Record<string, string> = {
  completed: "Completada",
  success: "Completada",
  failed: "No completada",
  error: "No completada",
  partial: "Completada parcialmente",
};

/**
 * Adapta sólo campos publicados: no interpreta un outcome ausente como éxito.
 * `summary` no se reutiliza porque el contrato actual lo arma con códigos internos
 * para los eventos auditados. Hasta que exista un resumen de negocio contractual,
 * la vista muestra una descripción neutra y conserva el tipo traducido por separado.
 */
export function actividadesRegistradas(
  response: { items: readonly ActivityLogItem[] } | null | undefined,
  max: number,
): ActividadRegistrada[] {
  if (!response?.items) return [];
  return response.items
    .filter((item) => item.event_type !== "financial_impact.regenerate")
    .slice(0, max)
    .map((item) => ({
      id: `${item.source}:${item.source_id}`,
      fuente: item.source,
      etiquetaFuente: ETIQUETA_FUENTE[item.source],
      tipo: ETIQUETA_EVENTO[item.event_type] ?? "Actividad registrada",
      resumen: ETIQUETA_EVENTO[item.event_type] ?? RESUMEN_FUENTE[item.source],
      creadaEn: item.created_at,
      resultado: item.outcome ? (RESULTADO[item.outcome] ?? "Resultado no disponible") : null,
    }));
}
