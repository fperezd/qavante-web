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

/** Monto de un documento del drill-down, firmado RELATIVO a su cuenta. Cada `net_amount` viene firmado
 *  como el accrual, así que una NC lleva el signo OPUESTO al de la factura. El signo del `total` de la
 *  cuenta define la dirección dominante (la factura queda positiva; la NC/reverso, negativa) → la lista
 *  reconcilia con el monto de la línea que se expandió. Antes un `Math.abs` pintaba la NC como gasto
 *  extra y la suma no cuadraba. `total === 0` → +1 (indiferente). Puro. */
export function montoDocEnCuenta(
  totalCuenta: string | null | undefined,
  netAmount: string | null | undefined,
): number {
  const signo = parseAmount(totalCuenta) < 0 ? -1 : 1;
  return signo * parseAmount(netAmount) || 0; // `|| 0` normaliza el −0 (signo × 0) a 0
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

/** `pct` string-decimal → "+12,5%" / "-7,1%" / "0%". Signo explícito salvo 0. El signo se decide
 *  sobre el valor YA REDONDEADO a 1 decimal: un 0,03% que se muestra como "0" no lleva "+". */
export function formatSignedPct(raw: string): string {
  // `|| 0` normaliza el −0 (Math.round(−0.4) = −0, y (−0).toLocaleString da "-0").
  const r = Math.round(parseAmount(raw) * 10) / 10 || 0;
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}

/** Tono de una variación: una variación POSITIVA del resultado es buena
 *  (verde), negativa mala (rojo), 0 neutra. */
export function variationTone(raw: string): "up" | "down" | "flat" {
  const n = parseAmount(raw);
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}
