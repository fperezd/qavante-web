import type { WorkInboxQueue } from "@/lib/api/work-inbox";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";

export function pendingCount(queues: WorkInboxQueue[]): number {
  return queues.reduce((total, queue) => total + queue.count, 0);
}

export function formattedQueueAmounts(queue: WorkInboxQueue): string[] {
  return queue.amounts.map(({ amount, currency }) => {
    if (!currency) return `${amount} · moneda no informada`;
    return formatMoneyFromDecimalString(amount, currency) ?? amount;
  });
}

export function emptyQueueLabel(queue: WorkInboxQueue): string {
  return queue.data_state === "available" ? "Sin pendientes" : "Sin pendientes confirmados";
}

export function queueCoverageLabel(queue: WorkInboxQueue): string | null {
  if (queue.data_state === "available") return null;
  return queue.data_state === "estimated" ? "Cobertura estimada" : "Cobertura parcial";
}
