import type { WorkInboxQueue } from "@/lib/api/work-inbox";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { MONTO_EN_REVISION } from "@/lib/formatters/amount";

/** Monto de la bandeja. `amount: null` = en revisión de conciliación (qavante-api#907): se
 *  nombra con la moneda, nunca como cero ni como el texto "null". */
export function formattedInboxAmount(amount: string | null, currency: string | null): string {
  if (amount == null) {
    return currency ? `${MONTO_EN_REVISION} (${currency})` : MONTO_EN_REVISION;
  }
  if (!currency) return `${amount} · moneda no informada`;
  return formatMoneyFromDecimalString(amount, currency) ?? amount;
}

export function pendingCount(queues: WorkInboxQueue[]): number {
  return queues.reduce((total, queue) => total + queue.count, 0);
}

export function formattedQueueAmounts(queue: WorkInboxQueue): string[] {
  return queue.amounts.map(({ amount, currency }) => formattedInboxAmount(amount, currency));
}

export function emptyQueueLabel(queue: WorkInboxQueue): string {
  return queue.data_state === "available" ? "Sin pendientes" : "Sin pendientes confirmados";
}

export function queueCoverageLabel(queue: WorkInboxQueue): string | null {
  if (queue.data_state === "available") return null;
  return queue.data_state === "estimated" ? "Cobertura estimada" : "Cobertura parcial";
}
