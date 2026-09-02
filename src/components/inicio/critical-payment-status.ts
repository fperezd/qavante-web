/**
 * El contrato de `next_critical` no permite deducir vencimiento: sólo un booleano
 * explícito autoriza publicar "Próximo" o "Más vencido". V01 y Inicio Ejecutivo
 * consumen el mismo hecho, por eso la clasificación vive aquí y no en una vista.
 */
export type EstadoVencimientoCritico = "proximo" | "vencido" | "sin_dato";

export function estadoVencimientoCritico(pago: { is_overdue?: unknown }): EstadoVencimientoCritico {
  if (typeof pago.is_overdue !== "boolean") return "sin_dato";
  return pago.is_overdue ? "vencido" : "proximo";
}
