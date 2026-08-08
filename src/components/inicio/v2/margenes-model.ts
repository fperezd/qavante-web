/* Modelo PURO del widget "Márgenes" del Inicio (sin React → testeable). Margen BRUTO (lo que queda tras
   el costo directo) y margen NETO (resultado sobre ventas), anclado al MES CERRADO (el en curso engaña).
   Fuente: /api/management/operational-result. Reusa mesCorto/resultadoConfiable de Gestión. */

import type { OperationalResultResponse } from "@/lib/api/gestion";
import { parseAmount } from "@/components/gestion/gestion-format";
import { mesCorto, resultadoConfiable } from "@/components/gestion/v2/gestion-v2-map";

export interface Margenes {
  mesLabel: string;
  ingresos: number;
  /** Margen bruto (ventas − costo directo), monto. */
  brutoMonto: number;
  /** Margen bruto %; `null` si no hay ventas. */
  brutoPct: number | null;
  /** Resultado neto, monto (con signo). */
  netoMonto: number;
  /** Margen neto % (resultado/ventas); `null` si no hay ventas. */
  netoPct: number | null;
  /** `false` si el resultado es implausible (no mostrar con confianza). */
  confiable: boolean;
}

/** Deriva los márgenes del mes cerrado desde su operational-result. `null` si no hay respuesta. */
export function margenesMesAnterior(resp: OperationalResultResponse | undefined): Margenes | null {
  if (!resp) return null;
  const ingresos = parseAmount(resp.revenue);
  const brutoMonto = parseAmount(resp.gross_margin);
  // Preferimos el % del backend si vino; si no, lo derivamos.
  const brutoPctRaw = parseAmount(resp.gross_margin_pct);
  const brutoPct =
    resp.gross_margin_pct != null && resp.gross_margin_pct !== ""
      ? Math.round(brutoPctRaw)
      : ingresos > 0
        ? Math.round((brutoMonto / ingresos) * 100)
        : null;
  const netoMonto = parseAmount(resp.result);
  const netoPct = ingresos > 0 ? Math.round((netoMonto / ingresos) * 100) : null;
  return {
    mesLabel: mesCorto(resp.period),
    ingresos,
    brutoMonto,
    brutoPct,
    netoMonto,
    netoPct,
    confiable: resultadoConfiable(resp),
  };
}
