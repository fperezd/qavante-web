/* Helpers puros de la pantalla Pagar (Sprint C4). SIN React → testeables.
   `parseAmount` se repite (consolidación pendiente, ver cobranza-format). */

import type { PaymentCategory, PayableCurrencyTotal, PayableItem } from "@/lib/api/pagos";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { formatMoney } from "@/lib/formatters/clp";

export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** `amount_clp` "en blanco": `null`, `undefined` o string vacío. El backend manda `""` (no solo
 *  `null`) cuando no hay conversión → hay que tratarlo como ausente, que `??` no hace (solo cubre
 *  null/undefined). */
function amountClpEnBlanco(v: string | null | undefined): boolean {
  return v == null || v === "";
}

/** ¿Es un ítem en moneda extranjera al que le FALTA el `amount_clp`? Entonces no tenemos su valor en
 *  pesos y NO debemos inventarlo con el nominal (US$1.240 ≠ $1.240). El backend debería mandar siempre
 *  `amount_clp` para las extranjeras (gap escalado, issue #726). Compartido por Pagar clásico y v2. */
export function montoCLPFaltante(item: PayableItem): boolean {
  const extranjera = (item.currency ?? "CLP").toUpperCase() !== "CLP";
  return extranjera && amountClpEnBlanco(item.amount_clp);
}

/** Monto en CLP del ítem: `amount_clp` si es moneda extranjera, si no `amount`. Una extranjera SIN
 *  `amount_clp` aporta 0 (no se suma su nominal como pesos) — así no contamina vencido/concentración/
 *  brecha/subtotales; la fila la marca como "sin convertir" (ver `montoCLPFaltante`). Ojo: para un ítem
 *  CLP con `amount_clp === ""` (no null) hay que caer a `amount` — `??` no lo haría y el ítem valdría 0
 *  (subestimando el total). */
export function montoCLP(item: PayableItem): number {
  if (montoCLPFaltante(item)) return 0;
  return parseAmount(amountClpEnBlanco(item.amount_clp) ? item.amount : item.amount_clp);
}

/** Desglose "$X (CLP) + US$Y (USD)" del total por pagar cuando hay más de una
 *  moneda (CC-API #560; el `total` ya viene convertido a CLP). `null` con 0 o 1
 *  moneda — no hay nada que desglosar. Puro/testeable. */
export function multiCurrencyNote(
  items: readonly PayableCurrencyTotal[] | undefined,
): string | null {
  if (!items || items.length < 2) return null;
  return items
    .map((it) => {
      const cur = (it.currency || "CLP").toUpperCase();
      return `${formatMoney(parseAmount(it.amount), cur)} (${cur})`;
    })
    .join(" + ");
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
