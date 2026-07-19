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
    YYYY-MM-DD diario) a un label legible es-CL. Convención de la app:
    nunca año-mes; mes-año para meses y DD-MM-AAAA para días.
    - "2026-05"     → "may 2026"
    - "2026-05-13"  → "13-05-2026" (DD-MM-AAAA, no ISO año-mes-día)
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
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if (day) {
    const [, y, m, d] = day;
    return `${d}-${m}-${y}`;
  }
  return period;
}

/* ── Semana en idioma de dueño ─────────────────────────────────────────────
   Un dueño de PYME no lee "W1"/"2026-W19"/"11-05-2026" como una semana. La
   mostramos como RANGO DE FECHAS reales: "Sem. 11–17 may" (o "28 abr – 4 may"
   si cruza de mes). Robusto a los formatos que puede mandar el backend. */

/** Lunes (00:00 local) de la semana, desde un lunes YYYY-MM-DD o una semana ISO
    YYYY-Www. `null` si no matchea. Exportada: el Caja v2 la usa para filtrar
    semanas pasadas (proyectar desde hoy) además de para el label. */
export function weekMondayFrom(period: string): Date | null {
  const iso = /^(\d{4})-W(\d{2})$/i.exec(period);
  if (iso) {
    const year = Number(iso[1]);
    const week = Number(iso[2]);
    // ISO 8601: la semana 1 es la que contiene el 4 de enero. El lunes de esa
    // semana + (week-1)·7 días = el lunes buscado.
    const jan4 = new Date(year, 0, 4);
    const jan4Dow = (jan4.getDay() + 6) % 7; // 0 = lunes … 6 = domingo
    return new Date(year, 0, 4 - jan4Dow + (week - 1) * 7);
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return null;
}

/** Lunes → "Sem. 11–17 may" (mismo mes) / "Sem. 28 abr – 4 may" (cruza mes). */
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const dM = monday.getDate();
  const dS = sunday.getDate();
  const mM = MONTHS_ES_CL[monday.getMonth()];
  const mS = MONTHS_ES_CL[sunday.getMonth()];
  return mM === mS ? `Sem. ${dM}–${dS} ${mM}` : `Sem. ${dM} ${mM} – ${dS} ${mS}`;
}

/** Label de un bucket del reporte de caja, consciente de la granularidad:
    - month → "may 2026"
    - week  → "Sem. 11–17 may" (rango de fechas reales, no "W1")
    - day   → "11-05-2026" (DD-MM-AAAA)
    Fallback defensivo al string original. */
export function formatBucketLabel(
  period: string,
  granularity?: "month" | "week" | "day",
): string {
  // Semana: rango de fechas reales (lunes a domingo).
  if (granularity === "week") {
    const monday = weekMondayFrom(period);
    if (monday) return formatWeekRange(monday);
  }
  // Mes y día reutilizan la convención existente (may 2026 / DD-MM-AAAA).
  return formatPeriodLabel(period);
}

/** "YYYY-MM" → "MM-YYYY" (ej. "2026-06" → "06-2026"). Para los selects y labels
    de rango: convención mes-año, nunca año-mes. Fallback al string original si
    no matchea el formato esperado. */
export function formatPeriodMMYYYY(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  return m ? `${m[2]}-${m[1]}` : period;
}

/** Opciones de mes para los selects de rango: [{value:"YYYY-MM", label:"MM-YYYY"}]
    desde `back` meses atrás hasta `forward` meses adelante de `now` (inclusive).
    `value` queda en YYYY-MM (lo que espera el backend); `label` en MM-YYYY. */
export function buildMonthOptions(
  now: Date = new Date(),
  back = 24,
  forward = 18,
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const y = now.getFullYear();
  const m = now.getMonth();
  for (let i = -back; i <= forward; i += 1) {
    const d = new Date(y, m + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: formatPeriodMMYYYY(value) });
  }
  return out;
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
