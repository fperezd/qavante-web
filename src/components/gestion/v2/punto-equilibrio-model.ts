/* Modelo PURO del Punto de equilibrio v2 (pedido de Fernando 2026-07-30): en vez de asumir qué es
   fijo/variable, toma las LÍNEAS DE COSTO RECURRENTES reales del breakdown por cuenta (últimos
   meses) y proyecta lo que hay que cubrir el PRÓXIMO mes con "último mes cerrado + tendencia".
   El punto de equilibrio = total a cubrir (una empresa de servicios casi no tiene costo variable,
   así que necesita vender ~lo que le cuesta). Excluye lo "sin clasificar" (ruido) e ignora el mes
   en curso para proyectar (usa los meses cerrados). PURO/testeable. */

import type { OperationalResultBreakdown, BreakdownRow } from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";

export interface LineaRecurrente {
  label: string;
  /** Último mes cerrado (magnitud, +). */
  mesAnterior: number;
  /** Mes en curso (magnitud, +). */
  mesActual: number;
  /** A cubrir el próximo mes (magnitud, +). */
  proyeccion: number;
  /** Aparece en <2 de los meses cerrados (posible hueco de clasificación) → se asume mensual. */
  soloUnMes: boolean;
}

export interface PuntoEquilibrio {
  lineas: LineaRecurrente[];
  /** Suma de las proyecciones = piso de venta para no perder. */
  totalACubrir: number;
  /** "YYYY-MM" del último mes cerrado y del mes en curso (para rotular las columnas). */
  mesAnterior: string;
  mesActual: string;
}

/** Solo las cuentas hoja (kind === "account") del árbol. */
function aplanarAccounts(rows: BreakdownRow[]): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  const rec = (rs: BreakdownRow[]) => {
    for (const r of rs) {
      if (r.kind === "account") out.push(r);
      if (r.children?.length) rec(r.children);
    }
  };
  rec(rows);
  return out;
}

/** Proyección de una serie de meses cerrados (magnitudes +): último mes + tendencia (pendiente
 *  promedio). Si la línea aparece en <2 meses (hueco de clasificación), se asume mensual con el
 *  monto del mes en que aparece (no se promedia a la baja). */
function proyectar(abs: number[]): { valor: number; soloUnMes: boolean } {
  const nz = abs.filter((v) => v > 0);
  if (nz.length < 2) return { valor: nz[0] ?? 0, soloUnMes: true };
  const base = abs[abs.length - 1]!;
  const slope = (abs[abs.length - 1]! - abs[0]!) / (abs.length - 1);
  return { valor: Math.max(0, base + slope), soloUnMes: false };
}

export function computePuntoEquilibrio(bd: OperationalResultBreakdown): PuntoEquilibrio | null {
  const months = bd.months ?? [];
  if (months.length < 2) return null;
  // Mes en curso = proforma (si el backend lo marca) o el último; proyectamos con los CERRADOS.
  const idxProforma = bd.proforma_month ? months.indexOf(bd.proforma_month) : -1;
  const actual = idxProforma >= 0 ? idxProforma : months.length - 1;
  if (actual < 1) return null; // sin al menos 1 mes cerrado no se puede proyectar

  const lineas: LineaRecurrente[] = [];
  for (const a of aplanarAccounts(bd.rows ?? [])) {
    if (/clasificar/i.test(a.label)) continue; // ruido sin clasificar → fuera
    const bm = (a.by_month ?? []).map((v) => parseAmount(v));
    if (bm.length !== months.length) continue; // desalineado → fuera (no inventar)
    const cerrados = bm.slice(0, actual); // meses cerrados (firmados)
    // Es costo/gasto si los cerrados son ≤ 0 y hay al menos uno < 0 (los ingresos son +).
    if (!(cerrados.some((v) => v < 0) && cerrados.every((v) => v <= 0))) continue;
    const abs = cerrados.map((v) => Math.abs(v));
    const { valor: proyeccion, soloUnMes } = proyectar(abs);
    if (proyeccion <= 0) continue;
    lineas.push({
      label: a.label,
      mesAnterior: abs[abs.length - 1]!, // último cerrado
      mesActual: Math.abs(bm[actual] ?? 0),
      proyeccion,
      soloUnMes,
    });
  }
  lineas.sort((x, y) => y.proyeccion - x.proyeccion);
  return {
    lineas,
    totalACubrir: lineas.reduce((s, l) => s + l.proyeccion, 0),
    mesAnterior: months[actual - 1] ?? "",
    mesActual: months[actual] ?? "",
  };
}
