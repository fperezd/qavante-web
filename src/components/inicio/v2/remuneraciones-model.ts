/* Modelo PURO del widget "Remuneraciones" del Inicio (sin React → testeable). Líquido total de la planilla
   del mes + dotación + cotizaciones (Previred). Fuente: /api/buk/payroll (totales agregados, sin detalle
   por empleado). Reusa mesCorto de Gestión. */

import type { PayrollResponse } from "@/lib/api/buk";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";

export interface Remuneraciones {
  mesLabel: string;
  /** Líquido total a pagar (CLP). */
  liquido: number;
  /** Dotación (empleados contados); `null` si no vino. */
  empleados: number | null;
  /** Cotizaciones Previred del período (CLP); `null` si no vino. */
  cotizaciones: number | null;
}

/** Deriva los totales de planilla del período. `null` si no hay líquido ni dotación (nada que mostrar). */
export function remuneracionesMes(
  resp: PayrollResponse | undefined,
  periodo: string,
): Remuneraciones | null {
  const t = resp?.totales;
  const liquido = t?.total_liquido ?? resp?.total_liquido ?? 0;
  const empleados = t?.empleados_contados ?? null;
  if (!liquido && !empleados) return null;
  return {
    mesLabel: mesCorto(periodo),
    liquido,
    empleados,
    cotizaciones: t?.total_cotizaciones ?? null,
  };
}
