/* Helpers puros del Inicio Ejecutivo (Sprint C8). SIN React → testeables.
   `parseAmount` se repite (consolidación pendiente). */

import type { PulsoStatus, Confidence } from "@/lib/api/dashboard";

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const PULSO_LABEL: Record<PulsoStatus, string> = {
  critical: "Crítica",
  weak: "Débil",
  stable: "Estable",
  strong: "Sólida",
};

export function pulsoStatusLabel(status: string): string {
  return PULSO_LABEL[status as PulsoStatus] ?? "Estable";
}

/** Color (clase de texto) del Pulso según estado. */
export function pulsoStatusTone(status: string): string {
  switch (status) {
    case "critical":
      return "text-danger-500";
    case "weak":
      return "text-warning-700";
    case "strong":
      return "text-success-700";
    default:
      return "text-brand-primary";
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
