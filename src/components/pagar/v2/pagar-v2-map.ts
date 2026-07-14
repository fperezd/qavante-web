/* Mapper PURO de Pagar v2 live (sin React): deriva desde `accounts-payable` los
   vencimientos (ordenados + postergabilidad), las 3 fechas clave del mes, la
   concentración por acreedor y la brecha de caja. Reusa los helpers del Pagar clásico
   (overdueThenCritical, overdueTotal, daysUntilDue, parseAmount). Montos string-decimal.

   Postergabilidad: HEURÍSTICA por categoría/criticidad (impuestos/sueldos/deuda = no
   postergable; baja criticidad = cubierto; resto = negociable). El backend no manda un
   flag de postergabilidad por ítem (brecha abierta, escalada); cuando llegue, se usa. */

import type { PayableItem, AccountsPayableResponse } from "@/lib/api/pagos";
import { parseAmount, paymentCategoryLabel } from "../pagos-format";
import { daysUntilDue, isOverdue, overdueTotal, overdueThenCritical } from "../pagos-v2-format";
import { categoryGroupLabel } from "../pagos-group";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import type { Vencimiento, Postergabilidad } from "./vencimientos-timeline";
import type { FechaClave, FechaClaveIcono } from "./fechas-clave-mes";
import type { ConcentracionItem } from "@/components/sii/libro-v2/concentracion-clientes";

const NO_POSTERGABLE = new Set(["tax", "payroll", "debt"]);

/** Postergabilidad heurística de un ítem (hasta que el backend la mande). */
export function postergabilidadDe(item: PayableItem): Postergabilidad {
  if (NO_POSTERGABLE.has(item.category)) return "no_postergable";
  if (item.criticality === "low") return "cubierto";
  return "negociable";
}

/** Monto en CLP del ítem: `amount_clp` si es moneda extranjera, si no `amount`. */
export function montoCLP(item: PayableItem): number {
  return parseAmount(item.amount_clp ?? item.amount);
}

/** Vencimientos ordenados por urgencia (vencido → criticidad) con su postergabilidad. */
export function mapVencimientos(items: PayableItem[], now: Date): Vencimiento[] {
  return overdueThenCritical(items, now).map((it, i) => {
    const extranjera = (it.currency ?? "CLP").toUpperCase() !== "CLP";
    return {
      id: it.source_external_id ?? `${it.label}-${i}`,
      vencido: isOverdue(it, now),
      fecha: formatDateLike(it.due_date),
      acreedor: it.counterparty_name ?? it.label,
      detalle: [paymentCategoryLabel(it.category), it.source].filter(Boolean).join(" · "),
      monto: montoCLP(it),
      montoOrigen: extranjera ? formatMoney(parseAmount(it.amount), it.currency) : undefined,
      postergabilidad: postergabilidadDe(it),
      estimado: it.estimated ?? false,
    };
  });
}

/** Las 3 fechas clave del mes (imposiciones · impuestos · sueldos), si están en los ítems. */
export function mapFechasClave(items: PayableItem[], now: Date): FechaClave[] {
  const esPrevired = (i: PayableItem) => /previred|cotiza|imposicion|leyes sociales/i.test(`${i.source} ${i.label}`);
  const previred = items.find(esPrevired);
  const impuesto = items.find((i) => i.category === "tax");
  const sueldos = items.find((i) => i.category === "payroll" && i !== previred);

  const build = (item: PayableItem | undefined, id: string, label: string, icono: FechaClaveIcono): FechaClave | null => {
    if (!item) return null;
    const dias = daysUntilDue(item.due_date, now);
    return {
      id,
      label,
      monto: montoCLP(item),
      vence: formatDateLike(item.due_date),
      enDias: dias ?? undefined,
      icono,
      estimado: item.estimated ?? false,
    };
  };

  return [
    build(previred, "imposiciones", "Imposiciones · Previred", "imposiciones"),
    build(impuesto, "impuestos", "Impuestos · F29 (IVA)", "impuestos"),
    build(sueldos, "sueldos", "Sueldos", "sueldos"),
  ].filter((x): x is FechaClave => x != null);
}

/** Concentración por acreedor (o categoría si no hay contraparte): top-N por monto. */
export function mapConcentracion(items: PayableItem[], topN = 6): ConcentracionItem[] {
  const map = new Map<string, { nombre: string; rut?: string; monto: number }>();
  for (const it of items) {
    const key = it.counterparty_name ?? categoryGroupLabel(it.category);
    const prev = map.get(key) ?? { nombre: key, rut: it.counterparty_rut ?? undefined, monto: 0 };
    prev.monto += montoCLP(it);
    map.set(key, prev);
  }
  const values = [...map.values()];
  const total = values.reduce((s, v) => s + v.monto, 0) || 1;
  return values
    .sort((a, b) => b.monto - a.monto)
    .slice(0, topN)
    .map((v) => ({ nombre: v.nombre, rut: v.rut, monto: v.monto, pct: (v.monto / total) * 100 }));
}

export interface BrechaInput {
  cajaProyectada: number;
  pagosCriticos: number;
  postergable: number;
}

/** Insumos de la brecha: caja proyectada 14d (del backend) vs pagos críticos (vencido +
 *  no postergables que vencen ≤14d), y cuánto de eso es postergable. */
export function mapBrecha(resp: AccountsPayableResponse, items: PayableItem[], now: Date): BrechaInput {
  const dentroDe14 = (i: PayableItem) => {
    const d = daysUntilDue(i.due_date, now);
    return d != null && d >= 0 && d <= 14;
  };
  const criticos = items
    .filter((i) => postergabilidadDe(i) === "no_postergable" && dentroDe14(i))
    .reduce((s, i) => s + montoCLP(i), 0);
  const postergable = items
    .filter((i) => postergabilidadDe(i) === "negociable" && dentroDe14(i))
    .reduce((s, i) => s + montoCLP(i), 0);
  return {
    cajaProyectada: parseAmount(resp.projected_cash_14d),
    pagosCriticos: overdueTotal(items, now) + criticos,
    postergable,
  };
}
