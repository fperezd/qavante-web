/* Helpers PUROS de la vista Pagar (control de gestión): bucket "Vencido",
 * subtotales por criticidad y orden vencido→crítico. Derivan del contrato
 * `accounts-payable` existente (due_date + criticality + amount). Testeable.
 * Presentación, no cálculo financiero nuevo. */

import type { PayableItem } from "@/lib/api/pagos";
import { montoCLP } from "./pagos-format";

const MS_PER_DAY = 86_400_000;

/** Días hasta el vencimiento (negativo = vencido). Compara por día calendario
 *  UTC para evitar off-by-one por hora/zona. Tolera fechas no-padded del backend
 *  (`2026-7-5`). `null` si la fecha no parsea. */
export function daysUntilDue(dueDate: string | null | undefined, now: Date): number | null {
  if (!dueDate) return null;
  // Normaliza `YYYY-M-D`/`YYYY-MM-DD` (con o sin hora) a un ISO UTC padded.
  const m = dueDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const iso = m ? `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}T00:00:00Z` : dueDate;
  const due = Date.parse(iso);
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

/** Suma de los montos vencidos, en CLP (una extranjera sin `amount_clp` NO se suma como pesos). */
export function overdueTotal(items: PayableItem[], now: Date): number {
  return items.reduce((acc, it) => acc + (isOverdue(it, now) ? montoCLP(it) : 0), 0);
}

/** Subtotales por criticidad (montos en CLP). */
export function subtotalsByCriticality(
  items: PayableItem[],
): Record<"high" | "medium" | "low", number> {
  const acc = { high: 0, medium: 0, low: 0 };
  for (const it of items) acc[it.criticality] += montoCLP(it);
  return acc;
}

/** Orden para la tabla: primero lo vencido (más atrasado arriba), luego por
 *  criticidad (crítico → bajo) y, a igual criticidad, lo que vence antes.
 *  Decora una vez con los días al vencimiento (evita re-parsear la fecha O(n·log n)
 *  veces) y ordena con desempate estable (sin `Infinity - Infinity = NaN`). */
export function overdueThenCritical(items: PayableItem[], now: Date): PayableItem[] {
  const rank: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
  const LATE = Number.MAX_SAFE_INTEGER; // sin fecha → al final del desempate
  return items
    .map((it) => ({ it, days: daysUntilDue(it.due_date, now) }))
    .sort((a, b) => {
      const aOver = a.days != null && a.days < 0;
      const bOver = b.days != null && b.days < 0;
      if (aOver !== bOver) return aOver ? -1 : 1;
      if (rank[a.it.criticality] !== rank[b.it.criticality]) {
        return rank[a.it.criticality] - rank[b.it.criticality];
      }
      return (a.days ?? LATE) - (b.days ?? LATE);
    })
    .map((d) => d.it);
}
