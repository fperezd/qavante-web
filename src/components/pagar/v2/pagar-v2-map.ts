/* Mapper PURO de Pagar v2 live (sin React): deriva desde `accounts-payable` los
   vencimientos (ordenados + postergabilidad), las 3 fechas clave del mes, la
   concentración por acreedor y las señales de caja del contrato. Reusa los helpers del Pagar clásico
   (overdueThenCritical, overdueTotal, daysUntilDue, parseAmount). Montos string-decimal.

   Postergabilidad: HEURÍSTICA por categoría/criticidad (impuestos/sueldos/deuda = no
   postergable; baja criticidad = cubierto; resto = negociable). El backend no manda un
   flag de postergabilidad por ítem (pendiente escalado); cuando llegue, se usa. */

import type { PayableItem } from "@/lib/api/pagos";
import type { ContraparteMaestro } from "@/components/terminos/terminos-pago";
import { parseAmount, paymentCategoryLabel, monedaVerificada, montoCLP, montoCLPFaltante } from "../pagos-format";
import { daysUntilDue, isOverdue, overdueThenCritical } from "../pagos-v2-format";
import { categoryGroupLabel } from "../pagos-group";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import type { Vencimiento, Postergabilidad } from "./vencimientos-timeline";
import type { FechaClave, FechaClaveIcono } from "./fechas-clave-mes";
import type { ConcentracionItem } from "@/components/sii/libro-v2/concentracion-clientes";

/** Apellido del titular de Pagar v2 (Ley 1: toda cifra lleva apellido). Describe el NÚMERO —
 *  `total` de `accounts-payable`, el agregado del servidor sobre todo el registro— y no la tabla
 *  de abajo, que compone otro universo (RCV compras + BHE + no-DTE) y no está completa (#302 P2-3). */
export const HERO_TOTAL_HINT =
  "Total que publica el servidor sobre todas tus cuentas por pagar registradas, convertido a pesos: proveedores, honorarios, impuestos, cotizaciones, sueldos, arriendos y deuda. Las monedas sin tipo de cambio quedan fuera de este total. No es la suma de la tabla de abajo: esa tabla compone proveedores y honorarios desde los libros del SII y no cubre todo el registro. La cobertura la publica la proyección canónica de 14 días.";

const NO_POSTERGABLE = new Set(["tax", "payroll", "debt"]);

/** Postergabilidad heurística de un ítem (hasta que el backend la mande). */
export function postergabilidadDe(item: PayableItem): Postergabilidad {
  if (NO_POSTERGABLE.has(item.category)) return "no_postergable";
  if (item.criticality === "low") return "cubierto";
  return "negociable";
}

// `montoCLP`/`montoCLPFaltante` viven ahora en `pagos-format` (compartidos con el Pagar clásico); se
// re-exportan acá para no romper los imports existentes (`pagar-v2-view-live`).
export { montoCLP, montoCLPFaltante };

/** Convierte una contraparte del maestro (compras/honorarios) en un PayableItem con el NETO
 *  por pagar (facturado net NC − conciliado) y la fecha del vencimiento derivado más urgente
 *  (el más temprano de sus docs no conciliados no-NC). `null` si no queda saldo. PURO. */
export function cpToPayableItem(cp: ContraparteMaestro, source: string): PayableItem | null {
  const neto = cp.total - cp.pagado;
  if (neto <= 0) return null;
  let due: Date | null = null;
  for (const d of cp.docs) {
    // Una factura ANULADA al 100% por NC (neto 0) no es deuda viva: no debe fijar el vencimiento
    // "más urgente" (si no, una anulada vieja pone el ítem como vencido y lo prioriza de más).
    if (d.pagado || d.esNotaCredito || d.anulacion === "anulada" || !d.vencimiento) continue;
    if (!due || d.vencimiento < due) due = d.vencimiento;
  }
  return {
    label: cp.name,
    category: "supplier",
    due_date: due ? due.toISOString().slice(0, 10) : "",
    /* La fecha sale del maestro de contrapartes, no de un payable publicado: el frontend no
       certifica su vencimiento (la certeza es server-owned). */
    due_date_certainty: "unconfirmed",
    amount: String(Math.round(neto)),
    criticality: cp.vencido > 0 ? "high" : "medium",
    source,
    counterparty_name: cp.name,
    counterparty_rut: cp.rut,
  };
}

/** Suma en CLP de los ítems que vencen dentro de `maxDias` (0..maxDias, sin los vencidos). PURO. */
export function sumItemsHasta(items: PayableItem[], now: Date, maxDias: number): number {
  return items.reduce((s, it) => {
    const d = daysUntilDue(it.due_date, now);
    return d != null && d >= 0 && d <= maxDias ? s + montoCLP(it) : s;
  }, 0);
}

/** Resuelve el onClick (drill-down) de un ítem; el container lo provee (navegación). Devuelve
 *  `undefined` para ítems sin destino → esos NO se renderean clickeables (sin afordance no-op). */
export type OnClickDe = (item: PayableItem) => (() => void) | undefined;

export type VencimientosOrder = "urgency" | "chronological";

export interface MapVencimientosOptions {
  /** La vista de evidencia usa fecha explícita; la vista heredada conserva su orden de urgencia. */
  order?: VencimientosOrder;
  /** La postergabilidad heredada es heurística y no puede acompañar al brief canónico. */
  includePostergabilidad?: boolean;
}

/** Vencimientos con orden y taxonomía explícitos para que la vista no infiera un plan por accidente. */
export function mapVencimientos(
  items: PayableItem[],
  now: Date,
  onClickDe?: OnClickDe,
  options: MapVencimientosOptions = {},
): Vencimiento[] {
  const order = options.order ?? "urgency";
  const orderedItems =
    order === "urgency"
      ? overdueThenCritical(items, now)
      : items
          .map((item, index) => ({ item, index }))
          .sort((a, b) => {
            const dueA = sortableDueDate(a.item.due_date);
            const dueB = sortableDueDate(b.item.due_date);
            return dueA - dueB || a.index - b.index;
          })
          .map(({ item }) => item);

  return orderedItems.map((it, i) => {
    const extranjera = monedaVerificada(it) && it.currency !== "CLP";
    return {
      id: it.source_external_id ?? `${it.label}-${i}`,
      vencido: isOverdue(it, now),
      fecha: formatDateLike(it.due_date),
      dueDate: it.due_date ?? null,
      acreedor: it.counterparty_name ?? it.label,
      detalle: [paymentCategoryLabel(it.category), it.source].filter(Boolean).join(" · "),
      monto: montoCLP(it),
      montoOrigen: extranjera ? formatMoney(parseAmount(it.amount), it.currency) : undefined,
      sinConversion: montoCLPFaltante(it),
      postergabilidad: options.includePostergabilidad === false ? undefined : postergabilidadDe(it),
      estimado: it.estimated ?? false,
      onClick: onClickDe?.(it),
    };
  });
}

function sortableDueDate(dueDate: string | null | undefined): number {
  const parsed = dueDate ? Date.parse(dueDate) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/** Las 3 fechas clave del mes (imposiciones · impuestos · sueldos), si están en los ítems. */
export function mapFechasClave(
  items: PayableItem[],
  now: Date,
  onClickDe?: OnClickDe,
): FechaClave[] {
  const esPrevired = (i: PayableItem) =>
    /previred|cotiza|imposicion|leyes sociales/i.test(`${i.source} ${i.label}`);
  const previred = items.find(esPrevired);
  const impuesto = items.find((i) => i.category === "tax");
  const sueldos = items.find((i) => i.category === "payroll" && i !== previred);

  const build = (
    item: PayableItem | undefined,
    id: string,
    label: string,
    icono: FechaClaveIcono,
  ): FechaClave | null => {
    if (!item) return null;
    const dias = daysUntilDue(item.due_date, now);
    return {
      id,
      label,
      monto: monedaVerificada(item) ? montoCLP(item) : null,
      vence: formatDateLike(item.due_date),
      enDias: dias ?? undefined,
      icono,
      estimado: item.estimated ?? false,
      onClick: onClickDe?.(item),
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
  // Base de participación: suma de los montos POSITIVOS. Evita el signo invertido / pct absurdo
  // si el total netea ≤ 0 (p.ej. notas de crédito). El componente igual clampa el display a 0-100.
  const base = values.reduce((s, v) => s + Math.max(0, v.monto), 0);
  const total = base > 0 ? base : 1;
  return values
    .sort((a, b) => b.monto - a.monto)
    .slice(0, topN)
    .map((v) => ({ nombre: v.nombre, rut: v.rut, monto: v.monto, pct: (v.monto / total) * 100 }));
}

/** Suma en CLP de lo vencido. Usa `montoCLP` (amount_clp para extranjeras), no el nominal
 *  crudo de `overdueTotal` — así un vencido en USD no se cuenta como si fueran pesos. */
export function overdueCLP(items: PayableItem[], now: Date): number {
  return items.reduce((acc, it) => acc + (isOverdue(it, now) ? montoCLP(it) : 0), 0);
}
