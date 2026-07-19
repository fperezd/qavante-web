/* Mapper PURO del Caja v2 live (sin React): deriva la serie de la curva de saldo desde el
   saldo de hoy + los netos del reporte de caja, y la caja mínima (CLP) desde el endpoint
   cash-minimum. El backend aún NO manda running_balance/min_cash en el cash-flow (brecha
   abierta), así que el FE los deriva; cuando lleguen, se usan directo. Montos string-decimal
   → `parseAmount`. */

import { parseAmount } from "@/components/inicio/dashboard-format";
import { weekMondayFrom } from "@/components/caja/cash-flow-format";
import { saldoAcumulado, type SaldoPunto } from "./caja-curva-model";
import type { CashFlowBucket } from "@/lib/api/treasury-reports";
import type { CashMinimumResponse } from "@/lib/api/cash-minimum";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de un período del cash-flow: `2026-07-14`→`14-jul`, `2026-07`→`jul`. */
export function labelBucketCorto(period: string): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(period);
  if (dm) return `${dm[3]}-${MESES[Number(dm[2]) - 1] ?? dm[2]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return MESES[Number(m[2]) - 1] ?? period;
  return period;
}

/** Serie de saldo proyectado = saldo de hoy + los netos por bucket, acumulados. El primer
 *  punto es "hoy" (saldo inicial); cada bucket mueve el saldo por su neto. */
export function serieDesdeCashFlow(
  saldoHoy: number,
  buckets: CashFlowBucket[],
  label: (period: string) => string = labelBucketCorto,
): SaldoPunto[] {
  const netos = buckets.map((b) => parseAmount(b.net));
  const acum = saldoAcumulado(saldoHoy, netos);
  return [
    { label: "hoy", saldo: saldoHoy },
    ...buckets.map((b, i) => ({ label: label(b.period), saldo: acum[i] ?? saldoHoy })),
  ];
}

type CFGranularity = "week" | "month" | "day";

/** Fin (exclusivo) del bucket según la granularidad. `null` si el `period` no matchea el formato. */
function bucketFin(period: string, granularity: CFGranularity): Date | null {
  if (granularity === "week") {
    const m = weekMondayFrom(period);
    return m ? new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7) : null;
  }
  if (granularity === "month") {
    const mm = /^(\d{4})-(\d{2})$/.exec(period);
    return mm ? new Date(Number(mm[1]), Number(mm[2]), 1) : null; // 1° del mes siguiente
  }
  const dd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  return dd ? new Date(Number(dd[1]), Number(dd[2]) - 1, Number(dd[3]) + 1) : null;
}

/** ¿El bucket ya terminó ANTES de `now`? Se usa para proyectar SOLO desde hoy hacia adelante:
 *  un bucket cuyo período ya pasó no debe re-aplicarse al saldo de hoy (ese flujo ya está dentro
 *  del saldo → doble conteo). No parseable → false (no lo descartamos). */
export function bucketPasado(period: string, granularity: CFGranularity, now: Date): boolean {
  const fin = bucketFin(period, granularity);
  return fin != null && fin <= now;
}

/** Filtra los buckets del reporte a los que NO terminaron antes de hoy: la proyección arranca
 *  DESDE HOY, no desde el inicio del período. Evita el doble conteo de buckets pasados. */
export function bucketsDesdeHoy(
  buckets: CashFlowBucket[],
  granularity: CFGranularity = "week",
  now: Date = new Date(),
): CashFlowBucket[] {
  return buckets.filter((b) => !bucketPasado(b.period, granularity, now));
}

/** Suma entra/sale/neto de una lista de buckets — para recomputar el flujo del período tras
 *  filtrar a futuro (el `grand_total` del backend suma TODOS los buckets, incluidos los pasados). */
export function flujoDeBuckets(buckets: CashFlowBucket[]): { entra: number; sale: number; neto: number } {
  let entra = 0;
  let sale = 0;
  let neto = 0;
  for (const b of buckets) {
    entra += parseAmount(b.total_inflow);
    sale += parseAmount(b.total_outflow);
    neto += parseAmount(b.net);
  }
  return { entra, sale, neto };
}

/** Serie del saldo ANCLADA en el saldo de hoy, sobre TODOS los buckets del rango. Reconstruye el
 *  saldo al cierre de cada período: el último bucket YA PASADO cierra ≈ al saldo de hoy (ese flujo
 *  ya está en el saldo), los anteriores se reconstruyen hacia atrás y los futuros se proyectan hacia
 *  adelante. Así el gráfico muestra la TRAYECTORIA (de dónde viene la caja + a dónde va) sin el doble
 *  conteo de re-aplicar flujos pasados al saldo de hoy. Un punto por bucket (cierre del período). */
export function serieAnclada(
  saldoHoy: number,
  buckets: CashFlowBucket[],
  granularity: CFGranularity,
  now: Date,
  label: (period: string) => string,
): SaldoPunto[] {
  if (buckets.length === 0) return [];
  // Cumulativo de netos desde el inicio del rango.
  const cum: number[] = [];
  let acc = 0;
  for (const b of buckets) {
    acc += parseAmount(b.net);
    cum.push(acc);
  }
  // Índice del último bucket ya pasado: su cierre ancla en el saldo de hoy. Si todos son futuros
  // (-1), el ancla es 0 → todo se proyecta desde el saldo de hoy.
  let lastPast = -1;
  buckets.forEach((b, i) => {
    if (bucketPasado(b.period, granularity, now)) lastPast = i;
  });
  const base = lastPast >= 0 ? (cum[lastPast] ?? 0) : 0;
  const offset = saldoHoy - base;
  return buckets.map((b, i) => ({ label: label(b.period), saldo: (cum[i] ?? 0) + offset }));
}

/** Caja mínima en CLP desde el endpoint cash-minimum, o `null` si no hay umbral CLP. */
export function cajaMinimoCLP(cm: CashMinimumResponse | undefined): number | null {
  const t = (cm?.thresholds ?? []).find((x) => (x.currency_code ?? "").toUpperCase() === "CLP");
  return t ? parseAmount(t.amount) : null;
}
