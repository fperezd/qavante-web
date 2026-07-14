/* Mapper PURO del Caja v2 live (sin React): deriva la serie de la curva de saldo desde el
   saldo de hoy + los netos del reporte de caja, y la caja mínima (CLP) desde el endpoint
   cash-minimum. El backend aún NO manda running_balance/min_cash en el cash-flow (brecha
   abierta), así que el FE los deriva; cuando lleguen, se usan directo. Montos string-decimal
   → `parseAmount`. */

import { parseAmount } from "@/components/inicio/dashboard-format";
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

/** Caja mínima en CLP desde el endpoint cash-minimum, o `null` si no hay umbral CLP. */
export function cajaMinimoCLP(cm: CashMinimumResponse | undefined): number | null {
  const t = (cm?.thresholds ?? []).find((x) => (x.currency_code ?? "").toUpperCase() === "CLP");
  return t ? parseAmount(t.amount) : null;
}
