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

/** ¿El bucket semanal ya terminó ANTES de `now`? Se usa para proyectar SOLO desde hoy hacia
 *  adelante: un bucket cuya semana ya pasó no debe re-aplicarse al saldo de hoy (ese flujo ya
 *  está dentro del saldo → doble conteo). No parseable → false (no lo descartamos). */
export function bucketSemanalPasado(period: string, now: Date): boolean {
  const monday = weekMondayFrom(period);
  if (!monday) return false;
  // Fin de la semana (exclusivo) = lunes + 7 días. Si ya llegó/pasó, la semana quedó atrás.
  const finSemana = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return finSemana <= now;
}

/** Filtra los buckets del reporte a los que NO terminaron antes de hoy: la proyección arranca
 *  DESDE HOY, no desde el inicio del mes. Evita el doble conteo de semanas pasadas. */
export function bucketsDesdeHoy(buckets: CashFlowBucket[], now: Date = new Date()): CashFlowBucket[] {
  return buckets.filter((b) => !bucketSemanalPasado(b.period, now));
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

/** Caja mínima en CLP desde el endpoint cash-minimum, o `null` si no hay umbral CLP. */
export function cajaMinimoCLP(cm: CashMinimumResponse | undefined): number | null {
  const t = (cm?.thresholds ?? []).find((x) => (x.currency_code ?? "").toUpperCase() === "CLP");
  return t ? parseAmount(t.amount) : null;
}
