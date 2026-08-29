/* Helpers puros del Inicio Ejecutivo (Sprint C8). SIN React → testeables.
   `parseAmount` vive en `@/lib/formatters/amount` y acá solo se re-exporta. */

import type { PulsoStatus, Confidence, DashboardSummaryResponse } from "@/lib/api/dashboard";

/** true si el summary no trae NINGÚN dato útil (todos los bloques null, sin
   frase ni acciones). Es el estado de una empresa nueva / sin fuentes cargadas:
   el backend responde 200 con todo en null. En ese caso la vista muestra un
   empty-state único en vez de 7 cards de "sin dato". */
export function isEmptySummary(data: DashboardSummaryResponse): boolean {
  return (
    !data.executive_phrase &&
    data.pulso == null &&
    data.cash_today == null &&
    data.cash_forecast == null &&
    data.cash_gap == null &&
    data.overdue_collections == null &&
    data.critical_payments == null &&
    data.operational_result == null &&
    (data.priority_actions == null || data.priority_actions.length === 0)
  );
}

/** Implementación ÚNICA en `@/lib/formatters/amount`; se re-exporta acá para no
 *  tocar los llamadores de este módulo. */
export { parseAmount } from "@/lib/formatters/amount";

const PULSO_LABEL: Record<NonNullable<PulsoStatus>, string> = {
  critical: "Crítica",
  weak: "Débil",
  stable: "Estable",
  strong: "Sólida",
};

/** Lo que se dice cuando la API NO SABE.
 *
 *  `status: null` es la abstención declarada del backend: sin saldo de apertura el Pulso es
 *  preliminar y no hay estado que publicar (qavante-api#162).
 *
 *  NO es lo mismo que un string fuera de contrato, y meterlos en el mismo cajón es el defecto
 *  que este módulo tenía: `?? "Estable"` convertía el "no sé" en la palabra más tranquilizadora
 *  del enum. Medido en producción sobre una caja en −$1.121.250, en la misma respuesta que
 *  reportaba la brecha. */
export const PULSO_SIN_DATO_LABEL = "Sin datos";

/** Etiqueta del estado del Pulso.
 *
 *  `null`/`undefined` (la API se abstiene) devuelve "Sin datos". Un valor inesperado sigue
 *  cayendo en "Estable": ese fallback existe para que la interfaz no quede con `undefined`, y
 *  se conserva a propósito. */
export function pulsoStatusLabel(status: string | null | undefined): string {
  if (status == null) return PULSO_SIN_DATO_LABEL;
  return PULSO_LABEL[status as NonNullable<PulsoStatus>] ?? "Estable";
}

/** `true` si la API se abstuvo. Para que quien pinta pueda decidir sin comparar contra el
 *  texto de la etiqueta. */
export function pulsoSinDato(status: string | null | undefined): boolean {
  return status == null;
}

/** Color (clase de texto) del Pulso según estado. */
export function pulsoStatusTone(status: string | null | undefined): string {
  switch (status) {
    case "critical":
      return "text-danger-500";
    case "weak":
      return "text-warning-700";
    case "strong":
      return "text-success-700";
    case null:
    case undefined:
      // Neutro, y NO rojo: "no sabemos" no es "está mal". Inventar una mala noticia es el
      // error simétrico de inventar una buena.
      return "text-neutral-mid";
    default:
      return "text-brand-primary";
  }
}

/** Color (clase de fondo) del semáforo del Pulso. Espeja `pulsoStatusTone` para
   el punto de estado (color + ícono/label, nunca color solo → daltonismo-safe). */
export function pulsoStatusDotBg(status: string | null | undefined): string {
  switch (status) {
    case "critical":
      return "bg-danger-500";
    case "weak":
      return "bg-warning-700";
    case "strong":
      return "bg-success-700";
    case null:
    case undefined:
      return "bg-neutral-mid";
    default:
      return "bg-brand-primary";
  }
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "confianza alta",
  medium: "confianza media",
  low: "confianza baja",
};

export function confidenceLabel(c: string): string {
  return CONFIDENCE_LABEL[c as Confidence] ?? "confianza media";
}
