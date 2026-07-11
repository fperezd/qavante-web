import type { PayableItem, PaymentCategory } from "@/lib/api/pagos";
import { parseAmount } from "./pagos-format";

/* Agrupación de pagos por CATEGORÍA — el eje universal multi-tenant ("en qué se
   me va la plata"): funciona igual para un retail (80% proveedores) que para una
   consultora (80% sueldos). PURO/testeable. */

export interface PayableGroup {
  category: PaymentCategory;
  items: PayableItem[];
  subtotal: number;
}

/** Agrupa por categoría y ordena por subtotal desc (dónde se concentra el pago). */
export function groupByCategory(items: ReadonlyArray<PayableItem>): PayableGroup[] {
  const map = new Map<PaymentCategory, PayableItem[]>();
  for (const it of items) {
    const arr = map.get(it.category);
    if (arr) arr.push(it);
    else map.set(it.category, [it]);
  }
  return [...map.entries()]
    .map(([category, groupItems]) => ({
      category,
      items: groupItems,
      subtotal: groupItems.reduce((s, i) => s + parseAmount(i.amount), 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

const GROUP_LABEL: Record<PaymentCategory, string> = {
  supplier: "Proveedores",
  tax: "Impuestos",
  payroll: "Remuneraciones",
  rent: "Arriendos",
  debt: "Deuda",
  leasing: "Leasing",
  other: "Otros",
};

export function categoryGroupLabel(category: string): string {
  return GROUP_LABEL[category as PaymentCategory] ?? "Otros";
}

/** Participación (%) — concentración de control de gestión. `total<=0` → 0. */
export function shareOfTotal(amount: number, total: number): number {
  return total > 0 ? (amount / total) * 100 : 0;
}
