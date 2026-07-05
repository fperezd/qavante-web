/* Rango de períodos (YYYY-MM) para el filtro de las pantallas SII/Remuneraciones.
 * PURO/testeable. El SII entrega datos POR MES; para "rango"/"último año" el FE
 * expande el rango a la lista de meses y consulta cada uno (orquestación en el
 * hook). Este módulo solo hace la aritmética de meses + los presets. */

export type RangePreset =
  | "mes_actual"
  | "mes_anterior"
  | "tres_meses"
  | "seis_meses"
  | "este_ano"
  | "ano_anterior";

export interface PeriodRange {
  /** Mes inicial `YYYY-MM` (inclusive). */
  desde: string;
  /** Mes final `YYYY-MM` (inclusive). */
  hasta: string;
}

/** `YYYY-MM` de una fecha. */
export function toPeriod(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Suma `delta` meses (puede ser negativo) a un período `YYYY-MM`. */
export function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const base = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

/** Compara dos períodos `YYYY-MM` (‑1, 0, 1). */
export function comparePeriod(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normaliza el rango para que `desde <= hasta` (los swapea si vienen al revés). */
export function orderRange(range: PeriodRange): PeriodRange {
  return comparePeriod(range.desde, range.hasta) <= 0
    ? range
    : { desde: range.hasta, hasta: range.desde };
}

/** ¿La fecha (ISO / `YYYY-MM-DD…`) cae dentro del rango (por mes, inclusive)?
 *  Compara el `YYYY-MM` de la fecha contra [desde, hasta]. null/vacío → false. */
export function isInPeriodRange(dateIso: string | null | undefined, range: PeriodRange): boolean {
  if (!dateIso) return false;
  const p = String(dateIso).slice(0, 7);
  const { desde, hasta } = orderRange(range);
  return comparePeriod(p, desde) >= 0 && comparePeriod(p, hasta) <= 0;
}

/** Expande un rango a la lista de meses `YYYY-MM` (inclusive), de viejo a nuevo.
 *  Cap de seguridad a 24 meses para no disparar demasiadas consultas. */
export function expandPeriodRange(range: PeriodRange, maxMonths = 24): string[] {
  const { desde, hasta } = orderRange(range);
  const out: string[] = [];
  let cur = desde;
  while (comparePeriod(cur, hasta) <= 0 && out.length < maxMonths) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Rango de un preset relativo a `now`. */
export function presetRange(preset: RangePreset, now: Date = new Date()): PeriodRange {
  const hastaMes = toPeriod(now);
  switch (preset) {
    case "mes_actual":
      return { desde: hastaMes, hasta: hastaMes };
    case "mes_anterior": {
      const prev = addMonths(hastaMes, -1);
      return { desde: prev, hasta: prev };
    }
    case "tres_meses":
      return { desde: addMonths(hastaMes, -2), hasta: hastaMes };
    case "seis_meses":
      return { desde: addMonths(hastaMes, -5), hasta: hastaMes };
    case "este_ano":
      return { desde: `${now.getFullYear()}-01`, hasta: hastaMes };
    case "ano_anterior": {
      const y = now.getFullYear() - 1;
      return { desde: `${y}-01`, hasta: `${y}-12` };
    }
  }
}

/** Rango por defecto al entrar a una pantalla (auto-carga): últimos 6 meses. */
export function defaultRange(now: Date = new Date()): PeriodRange {
  return presetRange("seis_meses", now);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de un período: `2026-02` → `feb-2026`. */
export function formatMonthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return `${MESES[m - 1]}-${y}`;
}

/** Etiqueta del rango: `feb-2026 a jul-2026`, o solo el mes si desde === hasta. */
export function formatRangeLabel(range: PeriodRange): string {
  const { desde, hasta } = orderRange(range);
  return desde === hasta
    ? formatMonthLabel(desde)
    : `${formatMonthLabel(desde)} a ${formatMonthLabel(hasta)}`;
}

/** ¿El rango coincide con un preset? (para marcar el chip activo). */
export function matchingPreset(range: PeriodRange, now: Date = new Date()): RangePreset | null {
  const presets: RangePreset[] = [
    "mes_actual",
    "mes_anterior",
    "tres_meses",
    "seis_meses",
    "este_ano",
    "ano_anterior",
  ];
  for (const p of presets) {
    const r = presetRange(p, now);
    if (r.desde === range.desde && r.hasta === range.hasta) return p;
  }
  return null;
}
