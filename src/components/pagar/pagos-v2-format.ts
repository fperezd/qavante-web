/* Helpers PUROS de la vista Pagar (control de gestión): bucket "Vencido",
 * subtotales por criticidad y orden vencido→crítico. Derivan del contrato
 * `accounts-payable` existente (due_date + criticality + amount). Testeable.
 * Presentación, no cálculo financiero nuevo. */

import type { PayableItem } from "@/lib/api/pagos";
import { parseAmount } from "./pagos-format";

const MS_PER_DAY = 86_400_000;

/** Días hasta el vencimiento (negativo = vencido). Compara por día calendario
 *  UTC para evitar off-by-one por hora/zona. `null` si la fecha no parsea. */
export function daysUntilDue(dueDate: string | null | undefined, now: Date): number | null {
  if (!dueDate) return null;
  const due = Date.parse(dueDate.length <= 10 ? `${dueDate}T00:00:00Z` : dueDate);
  if (Number.isNaN(due)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueDay = Math.floor(due / MS_PER_DAY) * MS_PER_DAY;
  return Math.round((dueDay - today) / MS_PER_DAY);
}

/** ¿El pago está vencido (due_date anterior a hoy)? */
export function isOverdue(item: PayableItem, now: Date): boolean {
  const d = daysUntilDue(item.due_date, now);
  return d != null && d < 0;
}

/** Suma de los montos vencidos. */
export function overdueTotal(items: PayableItem[], now: Date): number {
  return items.reduce((acc, it) => acc + (isOverdue(it, now) ? parseAmount(it.amount) : 0), 0);
}

/** Subtotales por criticidad (montos). */
export function subtotalsByCriticality(
  items: PayableItem[],
): Record<"high" | "medium" | "low", number> {
  const acc = { high: 0, medium: 0, low: 0 };
  for (const it of items) acc[it.criticality] += parseAmount(it.amount);
  return acc;
}

/** Orden para la tabla: primero lo vencido (más atrasado arriba), luego por
 *  criticidad (crítico → bajo) y, a igual criticidad, lo que vence antes. */
export function overdueThenCritical(items: PayableItem[], now: Date): PayableItem[] {
  const rank: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => {
    const da = daysUntilDue(a.due_date, now);
    const db = daysUntilDue(b.due_date, now);
    const aOver = da != null && da < 0;
    const bOver = db != null && db < 0;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (rank[a.criticality] !== rank[b.criticality])
      return rank[a.criticality] - rank[b.criticality];
    return (da ?? Infinity) - (db ?? Infinity);
  });
}
