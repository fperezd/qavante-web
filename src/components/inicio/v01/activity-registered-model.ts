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
  reversible_action: "Automatismo reversible",
  audit_event: "Evento auditado",
  sync_run: "Sincronización registrada",
};

/** Adapta sólo campos publicados: no interpreta un outcome ausente como éxito. */
export function actividadesRegistradas(
  response: { items: readonly ActivityLogItem[] } | null | undefined,
  max: number,
): ActividadRegistrada[] {
  if (!response?.items) return [];
  return response.items.slice(0, max).map((item) => ({
    id: `${item.source}:${item.source_id}`,
    fuente: item.source,
    etiquetaFuente: ETIQUETA_FUENTE[item.source],
    tipo: item.event_type,
    resumen: item.summary,
    creadaEn: item.created_at,
    resultado: item.outcome,
  }));
}
