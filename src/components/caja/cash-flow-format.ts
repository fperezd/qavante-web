/* Helpers puros del cash-flow report — extraídos de cash-flow-table.tsx
   para poder testear sin montar React. Cubre el parsing del formato
   string-decimal del backend (regex
   "^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$") y la traducción de `period` a label
   legible es-CL. */

const MONTHS_ES_CL = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/** String decimal del backend (puede venir como "0", "1234.56", "-700000",
    null o undefined) → number. Default 0 ante input vacío o inválido. */
export function parseDecimal(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza el neto a un entero CLP, colapsando `-0` y las fracciones que
    redondean a cero a un **0 positivo**. Sin esto, un neto fraccionario
    negativo (ej. -0.3) se muestra "$-0" (formatClp redondea a 0 pero conserva
    el signo) y se pinta de rojo por `net < 0` — un cero en rojo es incoherente
    (#12). Usar el resultado tanto para formatear como para decidir el color. */
export function normalizeNet(net: number): number {
  return Math.round(net) || 0;
}

/** Traduce el formato `period` del backend (YYYY-MM mensual/semanal,
    YYYY-MM-DD diario) a un label legible es-CL.
    - "2026-05"     → "may 2026"
    - "2026-05-13"  → "2026-05-13" (formato ISO ya legible)
    Cualquier otro formato cae al string original (fallback defensivo). */
export function formatPeriodLabel(period: string): string {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    const i = Number(m) - 1;
    /* Mes fuera de rango (00, 13..99): caer al string original como promete el
       JSDoc, en vez de un híbrido tipo "13 2026". */
    if (i < 0 || i > 11) return period;
    return `${MONTHS_ES_CL[i]} ${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return period;
  }
  return period;
}

/** Regex del formato canónico que acepta el endpoint backend:
    YYYY-MM con MM = 01..12. NO acepta "2026-13", "2026-00", "26-05", etc. */
export const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True si `period` matches el formato YYYY-MM válido para el backend. */
export function isValidPeriod(period: string): boolean {
  return PERIOD_REGEX.test(period);
}

/** True si `from` y `to` son ambos válidos y from ≤ to (comparación
    lexicográfica de YYYY-MM funciona porque el formato fijo lo permite). */
export function isValidPeriodRange(from: string, to: string): boolean {
  return isValidPeriod(from) && isValidPeriod(to) && from <= to;
}
