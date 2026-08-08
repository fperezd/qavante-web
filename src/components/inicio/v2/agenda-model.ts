/* Modelo PURO de la "Agenda de las próximas 2 semanas" (sin React → testeable). Reusa el motor forward
   de la caja (`caja-proyeccion-model`): cobros esperados (maestro AR) + pagos (maestro AP + obligaciones
   F29/Previred/sueldos/arriendo/deuda/leasing), acotados a 14 días (sin gracia = solo futuro), y los
   agrupa en "Esta semana" / "Próxima semana". No inventa fechas: cada vencimiento sale del mismo modelo
   que Cobrar/Pagar/Caja. */

import {
  movimientosDeMaestro,
  movimientosDeObligaciones,
  rangoSemanaLabel,
} from "@/components/caja/v2/caja-proyeccion-model";
import type { MovimientoCaja } from "@/components/caja/v2/caja-cascada-model";
import { addDays, daysBetween, type ContraparteMaestro } from "@/components/terminos/terminos-pago";
import type { PayableItem } from "@/lib/api/pagos";

/** Horizonte de la agenda: 2 semanas. */
export const HORIZONTE_AGENDA = 14;

/* Obligaciones de accounts-payable que SÍ son pagos futuros (el resto es ruido o duplica el maestro de
   proveedores). Mismo criterio que la cascada de Caja. */
const OBLIG_CATS = new Set(["payroll", "tax", "rent", "debt", "leasing"]);

/** Compone los vencimientos de los próximos 14 días (cobros +, pagos −), ordenados por fecha asc.
 *  `graceDias=0`: solo futuro (lo vencido viejo ya está reflejado en la caja). PURO. */
export function componerAgenda(
  cobranzas: ContraparteMaestro[],
  proveedores: ContraparteMaestro[],
  honorarios: ContraparteMaestro[],
  obligaciones: PayableItem[],
  hoy: Date,
): MovimientoCaja[] {
  const oblig = obligaciones.filter((i) => OBLIG_CATS.has(i.category ?? ""));
  const movs: MovimientoCaja[] = [
    ...movimientosDeMaestro(cobranzas, 1, "cobranza", hoy, HORIZONTE_AGENDA, 0),
    ...movimientosDeMaestro(proveedores, -1, "proveedor", hoy, HORIZONTE_AGENDA, 0),
    ...movimientosDeMaestro(honorarios, -1, "otro", hoy, HORIZONTE_AGENDA, 0),
    ...movimientosDeObligaciones(oblig, hoy, HORIZONTE_AGENDA, 0),
  ];
  return [...movs].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

export interface GrupoAgenda {
  titulo: string;
  /** Rango legible de la semana (ej. "8–14 ago"). */
  rango: string;
  items: MovimientoCaja[];
}

/** Agrupa los movimientos en "Esta semana" (días 0–6) y "Próxima semana" (días 7–13). Cada grupo ya
 *  viene ordenado por fecha (la entrada lo está). Grupos vacíos se conservan (la vista dice "nada"). */
export function agruparAgenda(movs: MovimientoCaja[], hoy: Date): GrupoAgenda[] {
  const esta: MovimientoCaja[] = [];
  const prox: MovimientoCaja[] = [];
  for (const m of movs) {
    const d = daysBetween(hoy, m.fecha);
    if (d < 0 || d > HORIZONTE_AGENDA) continue;
    (d < 7 ? esta : prox).push(m);
  }
  return [
    { titulo: "Esta semana", rango: rangoSemanaLabel(hoy, addDays(hoy, 6)), items: esta },
    {
      titulo: "Próxima semana",
      rango: rangoSemanaLabel(addDays(hoy, 7), addDays(hoy, 13)),
      items: prox,
    },
  ];
}

/** Totales de la agenda (cobros y pagos, ambos positivos) para el encabezado. */
export function totalesAgenda(movs: MovimientoCaja[]): {
  cobros: number;
  pagos: number;
  n: number;
} {
  let cobros = 0;
  let pagos = 0;
  for (const m of movs) {
    if (m.monto >= 0) cobros += m.monto;
    else pagos += -m.monto;
  }
  return { cobros, pagos, n: movs.length };
}
