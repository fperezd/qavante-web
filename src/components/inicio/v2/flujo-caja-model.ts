/* Modelo PURO del widget "Flujo de caja" (real) del Inicio (sin React → testeable). Muestra lo que
   REALMENTE entró y salió por mes CERRADO (el mes en curso está incompleto y engaña — misma honestidad
   que "¿Estás ganando dinero?" #880). Fuente: cash-flow report (financial_layer=committed = lo clasificado).
   NO confundir con "Flujo de caja proyectado" (forward, la card `caja`). */

import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";
import { parseAmount } from "@/components/gestion/gestion-format";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";

export interface FlujoMes {
  /** YYYY-MM del mes cerrado. */
  periodo: string;
  /** Mes corto (ej. "julio"). */
  mesLabel: string;
  /** Lo que entró (magnitud ≥ 0). */
  ingresos: number;
  /** Lo que salió (magnitud ≥ 0). */
  egresos: number;
  /** Neto del mes (con signo), autoritativo del backend. */
  neto: number;
}

export interface FlujoCaja {
  /** Meses cerrados en orden cronológico (viejo → nuevo). */
  meses: FlujoMes[];
  /** Mes cerrado más reciente (para el titular). */
  ultimo: FlujoMes;
}

/** Deriva el flujo real (entró/salió/neto) por mes CERRADO desde el cash-flow report. EXCLUYE el
 *  `periodoEnCurso` (mes incompleto). `null` si no hay ningún bucket cerrado (el contenedor degrada). */
export function flujoCajaReal(
  resp: CashFlowReportResponse | undefined,
  periodoEnCurso: string,
): FlujoCaja | null {
  if (!resp?.buckets?.length) return null;
  const meses: FlujoMes[] = resp.buckets
    // Solo meses CERRADOS: el en curso (y cualquier futuro) no es flujo real todavía.
    .filter((b) => b.period < periodoEnCurso)
    .map((b) => ({
      periodo: b.period,
      mesLabel: mesCorto(b.period),
      ingresos: Math.abs(parseAmount(b.total_inflow)),
      egresos: Math.abs(parseAmount(b.total_outflow)),
      // `net` es autoritativo del backend (no lo recalculamos: el signo de outflow varía por fuente).
      neto: parseAmount(b.net),
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const ultimo = meses.at(-1);
  if (!ultimo) return null;
  return { meses, ultimo };
}
