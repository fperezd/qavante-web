/* Helpers puros de la pantalla Pagar (Sprint C4). SIN React → testeables.
   `parseAmount` se repite (consolidación pendiente, ver cobranza-format). */

import type { PayableItem, PaymentCategory } from "@/lib/api/pagos";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Etiqueta legible de una obligación por pagar. Para las de categoría 'payroll'
 *  el backend manda un label genérico ("Remuneraciones — Doc 06"), que al usuario
 *  no le dice nada. Como la clave natural trae el período (`payroll-YYYYMM`), lo
 *  reescribimos al mes-año real ("Remuneraciones — Junio 2026"), que es como se
 *  piensa una planilla. Para el resto de categorías se respeta el label del
 *  backend. Puro/testeable. */
export function payableItemLabel(item: {
  label: string;
  category: string;
  source_external_id?: string | null;
}): string {
  if (item.category === "payroll" && item.source_external_id) {
    const m = /(\d{4})(\d{2})$/.exec(item.source_external_id);
    if (m) return `Remuneraciones — ${formatPeriodLabel(`${m[1]}-${m[2]}`)}`;
  }
  return item.label;
}

const CATEGORY_LABEL: Record<PaymentCategory, string> = {
  supplier: "Proveedor",
  tax: "Impuestos",
  payroll: "Sueldos",
  rent: "Arriendo",
  debt: "Deuda",
  leasing: "Leasing",
  other: "Otro",
};

export function paymentCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category as PaymentCategory] ?? "Otro";
}

const CRITICALITY_RANK: Record<PayableItem["criticality"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Ordena pagos: críticos primero, y dentro del mismo nivel por fecha de
 *  vencimiento ascendente (lo que vence antes, arriba). No muta el input. */
export function criticalFirst(items: PayableItem[]): PayableItem[] {
  return [...items].sort((a, b) => {
    const byCrit = CRITICALITY_RANK[a.criticality] - CRITICALITY_RANK[b.criticality];
    if (byCrit !== 0) return byCrit;
    return a.due_date.localeCompare(b.due_date);
  });
}
