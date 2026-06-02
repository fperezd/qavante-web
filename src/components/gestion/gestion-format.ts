/* Helpers puros de la pantalla de Resultado Operacional (Sprint C5). SIN
   React → testeables en vitest unit. Montos string-decimal del backend →
   number; navegación de período; labels es-CL. */

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

/** String-decimal del backend ("18500000", "-300000", null) → number; 0 ante
 *  input vacío o inválido. */
export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Período "YYYY-MM" + N meses → "YYYY-MM" (maneja cruce de año). Input
 *  inválido se devuelve tal cual. */
export function shiftPeriod(period: string, months: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + months;
  const y = Math.floor(total / 12);
  const mo = ((total % 12) + 12) % 12;
  return `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/** "2026-05" → "may 2026". Input inválido se devuelve tal cual. */
export function formatPeriodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return period;
  return `${MONTHS_ES_CL[idx]} ${m[1]}`;
}

/** Período actual (YYYY-MM) en America/Santiago — evita el bug de tomar el mes
 *  UTC del Worker en el borde de fin de mes. */
export function currentPeriodSantiago(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const mo = parts.find((p) => p.type === "month")?.value ?? "";
  return `${y}-${mo}`;
}

/** `pct` string-decimal → "+12,5%" / "-7,1%" / "0%". Signo explícito salvo 0. */
export function formatSignedPct(raw: string): string {
  const n = parseAmount(raw);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}

/** Tono de una variación: una variación POSITIVA del resultado es buena
 *  (verde), negativa mala (rojo), 0 neutra. */
export function variationTone(raw: string): "up" | "down" | "flat" {
  const n = parseAmount(raw);
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}
