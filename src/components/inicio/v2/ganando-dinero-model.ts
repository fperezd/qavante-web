/* Modelo PURO del widget "¿Estás ganando dinero?" del Inicio (sin React → testeable). Ancla SIEMPRE al
   MES ANTERIOR CERRADO (no el mes en curso, que está incompleto y engaña — barrido de honestidad #796).
   Reusa el criterio de Gestión (`gano = resultado ≥ 0`, `resultadoConfiable`, `mesCorto`). */

import type { OperationalResultResponse } from "@/lib/api/gestion";
import { parseAmount } from "@/components/gestion/gestion-format";
import { mesCorto, resultadoConfiable } from "@/components/gestion/v2/gestion-v2-map";

export interface GanandoDinero {
  /** `true` = ganó (resultado ≥ 0). */
  gano: boolean;
  /** Resultado operacional del mes cerrado (con signo). */
  resultado: number;
  /** Margen operacional % (resultado/ingresos); `null` si no hay ingresos positivos. */
  margenPct: number | null;
  /** Mes cerrado, corto (ej. "julio"). */
  mesLabel: string;
  /** `false` si el resultado es implausible (no mostrar con confianza). */
  confiable: boolean;
}

/** Deriva el "ganó/perdió" del mes cerrado desde el operational-result de ese período. `null` si no hay
 *  respuesta (el contenedor degrada). */
export function resultadoMesAnterior(
  resp: OperationalResultResponse | undefined,
): GanandoDinero | null {
  if (!resp) return null;
  const resultado = parseAmount(resp.result);
  const ingresos = parseAmount(resp.revenue);
  /* CRUDO, sin redondear: el redondeo lo hace `formatPct` en la vista. Redondeado acá, este
     widget decía "9%" sobre el mismo cociente que Gestión muestra como "9,3%". */
  const margenPct = ingresos > 0 ? (resultado / ingresos) * 100 : null;
  return {
    gano: resultado >= 0,
    resultado,
    margenPct,
    mesLabel: mesCorto(resp.period),
    confiable: resultadoConfiable(resp),
  };
}
