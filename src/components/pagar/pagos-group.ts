import type { PayableItem, PaymentCategory } from "@/lib/api/pagos";
import { montoCLP } from "./pagos-format";

/* Agrupación de pagos por CATEGORÍA — el eje universal multi-tenant ("en qué se
   me va la plata"): funciona igual para un retail (80% proveedores) que para una
   consultora (80% sueldos). PURO/testeable. */

export interface PayableGroup {
  category: PaymentCategory;
  items: PayableItem[];
  subtotal: number;
}

const KNOWN_CATEGORIES: ReadonlySet<string> = new Set([
  "supplier",
  "tax",
  "payroll",
  "rent",
  "debt",
  "leasing",
  "other",
]);

/** Agrupa por categoría y ordena por subtotal desc (dónde se concentra el pago).
    Una categoría que el backend agregue y el FE aún no conozca cae en "other" (un
    solo grupo "Otros", no dos). */
export function groupByCategory(items: ReadonlyArray<PayableItem>): PayableGroup[] {
  const map = new Map<PaymentCategory, PayableItem[]>();
  for (const it of items) {
    const category = (KNOWN_CATEGORIES.has(it.category) ? it.category : "other") as PaymentCategory;
    const arr = map.get(category);
    if (arr) arr.push(it);
    else map.set(category, [it]);
  }
  return [...map.entries()]
    .map(([category, groupItems]) => ({
      category,
      items: groupItems,
      subtotal: groupItems.reduce((s, i) => s + montoCLP(i), 0),
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

/** Período 'YYYY-MM' de un ítem de nómina desde su `source_external_id`
    ('payroll-YYYYMM' → 'YYYY-MM'), para linkear al detalle por empleado. `null`
    si no matchea. PURO. */
export function payrollPeriodFromExternalId(sourceExternalId?: string | null): string | null {
  if (!sourceExternalId) return null;
  const m = /payroll-(\d{4})(\d{2})$/.exec(sourceExternalId);
  return m ? `${m[1]}-${m[2]}` : null;
}
