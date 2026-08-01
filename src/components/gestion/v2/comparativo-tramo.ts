/* "Mismo tramo del mes" — compara VENTAS del mes en curso hasta el día N contra el mismo tramo del
   mes anterior (agosto 1→N vs julio 1→N), no contra el mes completo (peras con manzanas). Pedido de
   Fernando 2026-08-01. Sobre el RCV Ventas diario (el P&L es mensual y no da el corte al día). PURO.
   Netea NC con el mismo criterio del Libro (`computeRcvTotals`). */

import { computeRcvTotals, type RcvDocLike } from "@/components/sii/rcv-totals";

export interface DocFechado extends RcvDocLike {
  /** Fecha de emisión "DD/MM/YYYY" (RCV) o ISO "YYYY-MM-DD". */
  fecha?: string;
}

/** Día del mes (1-31) de la fecha; 99 si no parsea (queda fuera de cualquier corte). */
export function diaDelMes(fecha: string | undefined): number {
  const dmy = /^(\d{1,2})\/\d{1,2}\//.exec(String(fecha ?? ""));
  if (dmy) return Number(dmy[1]);
  const iso = /^\d{4}-\d{2}-(\d{2})/.exec(String(fecha ?? ""));
  if (iso) return Number(iso[1]);
  return 99;
}

/** Ventas NETAS (afecto + exento, NC restadas) de los docs cuya emisión cae en los primeros `dia`
 *  días del mes. `dia >= 31` ⇒ el mes completo. */
export function ventasNetasHastaDia(docs: DocFechado[], dia: number): number {
  const t = computeRcvTotals(docs.filter((d) => diaDelMes(d.fecha) <= dia));
  return t.neto + t.exento;
}

/** Ventas netas de todo el período (mes completo). */
export function ventasNetasTotal(docs: DocFechado[]): number {
  const t = computeRcvTotals(docs);
  return t.neto + t.exento;
}
