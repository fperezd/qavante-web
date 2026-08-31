/* Modelo PURO del widget "Comportamiento de pago" del Inicio (sin React → testeable). El diferenciador de
   Qavante: cuántos días, en promedio (ponderado por monto), tus clientes pagan respecto del vencimiento
   nominal (+ = DESPUÉS, − = antes). Fuente: /api/treasury/collection-projection (`vs_nominal`, ADR-0083 B2). */

import type { CollectionProjectionResponse } from "@/lib/api/treasury";
import { concordar } from "@/lib/formatters/count";

export interface ComportamientoPago {
  /** Días promedio vs vencimiento nominal (+ = pagan después, − = antes); `null` sin comparables. */
  shiftDays: number | null;
  /** Facturas fechadas por comportamiento real del pagador (con historial). */
  docsComportamiento: number;
  /** Facturas fechadas por due_date (sin historial → nominal, honesto). */
  docsVencimiento: number;
}

/** Deriva el comportamiento de pago desde la proyección de cobros. `null` si no hay ninguna factura
 *  comparable (ni por comportamiento ni por vencimiento). */
export function comportamientoPago(
  resp: CollectionProjectionResponse | undefined,
): ComportamientoPago | null {
  const v = resp?.vs_nominal;
  if (!v) return null;
  if (v.docs_comportamiento === 0 && v.docs_por_vencimiento === 0) return null;
  return {
    shiftDays: v.behavior_shift_days ?? null,
    docsComportamiento: v.docs_comportamiento,
    docsVencimiento: v.docs_por_vencimiento,
  };
}

/** "día"/"días" — concordancia N=1 del widget (issue #94: un shift promedio de 1 día es un caso
 * real —una empresa recién con historial— no de laboratorio; y "3 facturas" puede ser "1
 * factura" en el mismo arranque). PURA. */
export function diaSufijo(n: number): string {
  return concordar(n, "día", "días");
}

/** "3 facturas fechadas" / "1 factura fechada" — mismo criterio, para el pie del widget. Frase
 * completa (no sólo el sustantivo): el adjetivo "fechada/fechadas" también concuerda, que es
 * justo el tipo de defecto a medias que el issue #94 pide evitar ("1 factura fechadaS" sería
 * tan roto como "1 facturas"). */
export function facturaFechadaLabel(n: number): string {
  return concordar(n, "factura fechada", "facturas fechadas");
}
