/* Helpers PUROS de "Por clasificar" v2 (progreso, confianza, orden). Testeable. */

export type Tone = "success" | "warning" | "danger" | "neutral";

export interface UnclassifiedMovement {
  id: string;
  date: string;
  glosa: string;
  /** Monto (string-decimal; negativo = egreso). */
  amount: string;
  /** Sugerencia del backend (si la hay). */
  suggested_account?: string | null;
  /** Confianza 0–1. */
  confidence?: number | null;
}

export function parseAmount(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tono de la confianza de la sugerencia automática. */
export function confidenceTone(confidence: number | null | undefined): Tone {
  if (confidence == null) return "neutral";
  if (confidence >= 0.8) return "success";
  if (confidence >= 0.5) return "warning";
  return "danger";
}

export function confidencePct(confidence: number | null | undefined): string {
  if (confidence == null) return "—";
  return `${Math.round(confidence * 100)}%`;
}

/** Ordena por monto absoluto descendente (atacar primero lo material). */
export function sortByAmountDesc(items: UnclassifiedMovement[]): UnclassifiedMovement[] {
  return [...items].sort((a, b) => Math.abs(parseAmount(b.amount)) - Math.abs(parseAmount(a.amount)));
}

/** Suma del monto absoluto pendiente. */
export function totalPending(items: UnclassifiedMovement[]): number {
  return items.reduce((acc, m) => acc + Math.abs(parseAmount(m.amount)), 0);
}

/** % clasificado del universo del período. */
export function classifiedPct(totalMovements: number, unclassifiedCount: number): number {
  if (totalMovements <= 0) return 0;
  return ((totalMovements - unclassifiedCount) / totalMovements) * 100;
}
