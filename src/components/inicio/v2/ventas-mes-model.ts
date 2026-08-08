/* Modelo PURO del widget "Ventas por mes" del Inicio (sin React → testeable). Tendencia del neto vendido
   mes a mes (afecto + exento − NC), meses CERRADOS. Fuente: /api/sii/rcv/ventas/comparativos (serie
   mensual pre-agregada por CC-API #766, ya neteada de NC). Reusa mesCorto de Gestión. */

import type { LibroComparativosResponse } from "@/lib/api/sii";
import { parseAmount } from "@/components/gestion/gestion-format";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";

export interface VentaMes {
  periodo: string;
  mesLabel: string;
  neto: number;
}

export interface VentasPorMes {
  /** Meses en orden cronológico (viejo → nuevo). */
  meses: VentaMes[];
  /** Mes más reciente (para el titular). */
  ultimo: VentaMes;
  /** Variación % del último mes vs el anterior; `null` si no hay comparable o base 0. */
  variacionPct: number | null;
}

/** Deriva la serie de ventas por mes desde los comparativos del Libro. `null` si no hay serie. */
export function ventasPorMes(resp: LibroComparativosResponse | undefined): VentasPorMes | null {
  const serie = resp?.serie_mensual;
  if (!serie?.length) return null;
  const meses: VentaMes[] = serie
    .map((p) => ({
      periodo: p.periodo,
      mesLabel: mesCorto(p.periodo),
      neto: parseAmount(p.neto),
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const ultimo = meses.at(-1);
  if (!ultimo) return null;
  const previo = meses.at(-2);
  const variacionPct =
    previo && previo.neto !== 0
      ? Math.round(((ultimo.neto - previo.neto) / Math.abs(previo.neto)) * 100)
      : null;
  return { meses, ultimo, variacionPct };
}
