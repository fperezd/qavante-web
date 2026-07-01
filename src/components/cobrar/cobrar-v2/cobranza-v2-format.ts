/* Helpers PUROS de Cobrar v2 (priorización, concentración, DSO). Presentación
 * sobre datos ya entregados por el backend — no cálculo financiero nuevo. */

export type Tone = "success" | "warning" | "danger" | "neutral";

export function parseAmount(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Score de urgencia de cobranza = saldo × días de mora (0 si aún no vence).
 *  Prioriza plata grande y vieja, que es como se gestiona la cobranza real. */
export function urgencyScore(balance: string, daysOverdue: number): number {
  return parseAmount(balance) * Math.max(daysOverdue, 0);
}

/** Prioridad de gestión según días de mora. */
export function priorityTone(daysOverdue: number): { tone: Tone; label: string } {
  if (daysOverdue <= 0) return { tone: "neutral", label: "Por vencer" };
  if (daysOverdue > 60) return { tone: "danger", label: "Alta" };
  if (daysOverdue > 15) return { tone: "warning", label: "Media" };
  return { tone: "neutral", label: "Baja" };
}

/** % que representan los top-N deudores sobre el total (concentración). */
export function concentrationPct(debtorTotals: string[], total: string, topN = 3): number {
  const t = parseAmount(total);
  if (t <= 0) return 0;
  const top = [...debtorTotals]
    .map(parseAmount)
    .sort((a, b) => b - a)
    .slice(0, topN)
    .reduce((a, b) => a + b, 0);
  return (top / t) * 100;
}

/** Tendencia del DSO: menos días es mejor (verde), más días peor (rojo). */
export function dsoTrend(
  current: number | null,
  previous: number | null,
): { tone: Tone; deltaDays: number | null } {
  if (current == null || previous == null) return { tone: "neutral", deltaDays: null };
  const delta = current - previous;
  if (delta > 0) return { tone: "danger", deltaDays: delta }; // cobrando más lento
  if (delta < 0) return { tone: "success", deltaDays: delta }; // cobrando más rápido
  return { tone: "neutral", deltaDays: 0 };
}
