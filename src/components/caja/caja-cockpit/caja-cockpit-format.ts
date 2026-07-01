/* Helpers PUROS del Cockpit de Caja (presentación — no cálculo financiero:
 * solo derivan color/label de montos que el backend ya entregó). Testeable. */

import type { CashTodayLike } from "./types";

export type Tone = "success" | "warning" | "danger" | "neutral";

/** Parseo defensivo de un monto string-decimal a number. */
export function parseAmount(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Semáforo del runway (días de caja): <14 crítico, <30 ajustado, ≥30 sano. */
export function runwayTone(days: number | null | undefined): Tone {
  if (days == null) return "neutral";
  if (days < 14) return "danger";
  if (days < 30) return "warning";
  return "success";
}

/** Label del `data_state` de CashToday. */
export function dataStateLabel(state: CashTodayLike["data_state"]): { label: string; tone: Tone } {
  switch (state) {
    case "available":
      return { label: "Al día", tone: "success" };
    case "stale":
      return { label: "Desactualizado", tone: "warning" };
    case "estimated":
      return { label: "Estimado", tone: "neutral" };
  }
}

/** Holgura de caja a 14d = caja proyectada − obligaciones críticas (con signo). */
export function cashCushion14d(projected: string, critical: string): number {
  return parseAmount(projected) - parseAmount(critical);
}
