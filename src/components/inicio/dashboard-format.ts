/* Helpers puros del Inicio Ejecutivo (Sprint C8 + v2). SIN React → testeables.
   `parseAmount` se repite (consolidación pendiente). */

import type {
  PulsoStatus,
  Confidence,
  DashboardSummaryResponse,
  ObligationCoverage,
} from "@/lib/api/dashboard";

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

/** Color (clase de fondo) del semáforo del Pulso. Espeja `pulsoStatusTone` para
   el punto de estado (color + ícono/label, nunca color solo → daltonismo-safe). */
export function pulsoStatusDotBg(status: string): string {
  switch (status) {
    case "critical":
      return "bg-danger-500";
    case "weak":
      return "bg-warning-700";
    case "strong":
      return "bg-success-700";
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

/* ── Helpers del Inicio Ejecutivo v2 ──────────────────────────────────────── */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Primer término del nombre, para el saludo ("Fernando Pérez" → "Fernando"). */
export function firstName(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Fecha hasta la que alcanza la caja a partir de los días de runway, relativo
   a `from`. "18 de julio" (agrega año solo si cae en otro año). null si no hay
   dato. Es presentación (no cálculo de negocio: los días los da el backend). */
export function runwayDateLabel(daysOfCash: number | null | undefined, from: Date): string | null {
  if (daysOfCash == null || !Number.isFinite(daysOfCash) || daysOfCash < 0) return null;
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + Math.round(daysOfCash));
  const anio = d.getFullYear() !== from.getFullYear() ? ` de ${d.getFullYear()}` : "";
  return `${d.getDate()} de ${MESES[d.getMonth()]}${anio}`;
}

const COVERAGE_LABEL: Record<ObligationCoverage, string> = {
  covered: "cubierto",
  tight: "ajustado",
  uncovered: "no alcanza",
};

export function obligationCoverageLabel(c: string): string {
  return COVERAGE_LABEL[c as ObligationCoverage] ?? "—";
}

/** Color (clase de texto) del estado de una obligación. */
export function obligationCoverageTone(c: string): string {
  switch (c) {
    case "covered":
      return "text-success-700";
    case "tight":
      return "text-warning-700";
    case "uncovered":
      return "text-danger-500";
    default:
      return "text-neutral-mid";
  }
}

/** "↑8%" / "↓3%" para la variación de caja; null si no hay dato. */
export function deltaPctLabel(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return `${pct >= 0 ? "↑" : "↓"}${Math.abs(pct)}%`;
}
