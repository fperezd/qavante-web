/* Cálculo PURO de los comparativos del ritmo de ventas del Libro v2 (sin React, sin
   red). El FE hace agregados de LECTURA sobre los docs del SII (§17.4: no calcula el
   dato oficial —ese es el F29—, pero sí resúmenes como computeRcvTotals). Todo % es
   `null` cuando la base no permite un cambio con sentido (base ≤ 0) → se degrada, no
   se muestra ∞/NaN. Reusa `toIsoDate` (parser de fechas del SII) y `computeRcvTotals`
   (neteo de notas de crédito). El resultado calza con `HeroComparativo` de VentasHero. */

import type { RcvDoc } from "../rcv-grouped-item";
import type { HeroComparativo } from "./ventas-hero";
import { computeRcvTotals } from "../rcv-totals";
import { toIsoDate } from "../dte-date";

/** % de cambio de `base` a `actual`. `null` si base ≤ 0 (sin comparación con sentido). */
export function pctCambio(base: number, actual: number): number | null {
  if (!(base > 0)) return null;
  return ((actual - base) / base) * 100;
}

/** Promedio simple; `null` si no hay elementos. */
export function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

/** Neto (con NC ya neteadas) de un conjunto de documentos. */
export function netoDocs(docs: RcvDoc[]): number {
  return computeRcvTotals(docs).neto;
}

/** Día del mes (1-31) de una fecha del SII en cualquier formato, o `null`. */
export function diaDelMes(fecha: string | undefined): number | null {
  const iso = toIsoDate(fecha);
  if (!iso) return null;
  const day = Number(iso.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null;
}

/** Docs cuyo día del mes es ≤ `diaLimite` — para comparar "hasta la misma fecha"
 *  (no un mes completo contra uno parcial). */
export function docsHastaDiaDelMes(docs: RcvDoc[], diaLimite: number): RcvDoc[] {
  return docs.filter((d) => {
    const dia = diaDelMes(d.fecha);
    return dia != null && dia <= diaLimite;
  });
}

export interface ComparativosInput {
  /** Docs del mes en curso (para el comparativo "misma fecha"). */
  mesActual?: RcvDoc[];
  /** Docs del mes anterior completo (para el comparativo "misma fecha"). */
  mesAnterior?: RcvDoc[];
  /** Día de corte para "hasta la misma fecha" (típico: hoy). */
  diaCorte?: number;
  /** Neto del mes anterior cerrado (para vs. promedio anual). */
  netoMesAnterior?: number;
  /** Netos por mes del año en curso (para el promedio anual). */
  netosDelAnio?: number[];
  /** Etiqueta del mes anterior, ej. "julio". */
  labelMesAnterior?: string;
  /** Neto del período seleccionado (para YoY). */
  netoPeriodo?: number;
  /** Neto del mismo período del año anterior (para YoY). */
  netoPeriodoAnioAnterior?: number;
}

/** Arma los comparativos que HAYA cómo calcular; omite los que no (degradado
 *  honesto). El orden es corto plazo → contexto anual → año contra año. */
export function calcularComparativos(input: ComparativosInput): HeroComparativo[] {
  const out: HeroComparativo[] = [];

  // 1) Este mes vs. misma fecha del mes anterior.
  if (input.mesActual && input.mesAnterior && input.diaCorte != null) {
    const actual = netoDocs(docsHastaDiaDelMes(input.mesActual, input.diaCorte));
    const base = netoDocs(docsHastaDiaDelMes(input.mesAnterior, input.diaCorte));
    const pct = pctCambio(base, actual);
    if (pct != null) out.push({ pct, label: "este mes vs. misma fecha del mes anterior" });
  }

  // 2) Mes anterior sobre el promedio mensual del año.
  if (input.netoMesAnterior != null && input.netosDelAnio && input.netosDelAnio.length > 0) {
    const prom = promedio(input.netosDelAnio);
    const pct = prom != null ? pctCambio(prom, input.netoMesAnterior) : null;
    if (pct != null) {
      out.push({
        pct,
        label: `${input.labelMesAnterior ?? "el mes anterior"} sobre el promedio mensual del año`,
      });
    }
  }

  // 3) vs. el mismo período del año anterior (YoY).
  if (input.netoPeriodo != null && input.netoPeriodoAnioAnterior != null) {
    const pct = pctCambio(input.netoPeriodoAnioAnterior, input.netoPeriodo);
    if (pct != null) out.push({ pct, label: "vs. el mismo período del año anterior" });
  }

  return out;
}
