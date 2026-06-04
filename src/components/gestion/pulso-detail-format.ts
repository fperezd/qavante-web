/* Helpers puros del Pulso detalle (Sprint C6/C7). SIN React → testeables.
   El color/label del estado y la confianza se reusan de dashboard-format. */

import type { PulsoImpact, PulsoDetailResponse } from "@/lib/api/pulso";

/** Ancho de barra (0–100 → "NN%"), clampeado. Para los ejes y el trend. */
export function scoreBarWidth(score: number): string {
  const n = Number.isFinite(score) ? score : 0;
  const clamped = Math.max(0, Math.min(100, n));
  return `${clamped}%`;
}

const IMPACT_ORDER: Record<PulsoImpact, number> = { high: 0, medium: 1, low: 2 };

/** Ordena drivers por impacto (alto → bajo). Estable; no muta el array. */
export function sortDriversByImpact<T extends { impact: PulsoImpact }>(drivers: T[]): T[] {
  return [...drivers].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
}

const IMPACT_LABEL: Record<PulsoImpact, string> = {
  high: "impacto alto",
  medium: "impacto medio",
  low: "impacto bajo",
};

export function impactLabel(impact: string): string {
  return IMPACT_LABEL[impact as PulsoImpact] ?? "impacto medio";
}

/** true si el detalle no trae nada para mostrar (Pulso sin calcular aún). */
export function isEmptyPulsoDetail(data: PulsoDetailResponse): boolean {
  return (
    !data.headline &&
    data.components.length === 0 &&
    data.drivers.length === 0 &&
    data.trend.length === 0
  );
}
