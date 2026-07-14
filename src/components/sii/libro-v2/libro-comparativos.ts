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
import { addMonths, comparePeriod, expandPeriodRange, toPeriod, type PeriodRange } from "@/lib/period/period-range";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Nombre completo del mes de un período `YYYY-MM` (ej. "2026-07" → "julio"). */
export function nombreMes(periodo: string): string {
  const m = Number(periodo.slice(5, 7));
  return NOMBRES_MES[m - 1] ?? periodo;
}

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

/** Plan PURO de qué períodos (`YYYY-MM`) hay que bajar del SII para los 3 comparativos,
 *  dado el rango seleccionado y "hoy". El hook consulta `periodos` (deduplicados por
 *  react-query con los del propio rango) y arma el `ComparativosInput`. */
export interface PlanComparativos {
  /** Unión única de todos los meses a consultar. */
  periodos: string[];
  mesActual: string;
  mesAnterior: string;
  /** Meses COMPLETOS del año en curso (ene…mes anterior) para el promedio. Vacío en
   *  enero (el mes anterior cae en el año pasado → se degrada el comparativo). */
  mesesAnio: string[];
  labelMesAnterior: string;
  /** Meses del rango seleccionado (para el neto del período, YoY). */
  rango: string[];
  /** El rango corrido 12 meses atrás (para el YoY). */
  rangoAnioAnterior: string[];
  diaCorte: number;
}

export function planComparativoPeriodos(range: PeriodRange, today: Date): PlanComparativos {
  const mesActual = toPeriod(today);
  const mesAnterior = addMonths(mesActual, -1);
  const diaCorte = today.getDate();
  const year = mesActual.slice(0, 4);

  const mesesAnio: string[] = [];
  if (mesAnterior.slice(0, 4) === year) {
    let cur = `${year}-01`;
    while (comparePeriod(cur, mesAnterior) <= 0) {
      mesesAnio.push(cur);
      cur = addMonths(cur, 1);
    }
  }

  const rango = expandPeriodRange(range);
  const rangoAnioAnterior = rango.map((p) => addMonths(p, -12));
  const periodos = Array.from(
    new Set([mesActual, mesAnterior, ...mesesAnio, ...rango, ...rangoAnioAnterior]),
  ).sort();

  return { periodos, mesActual, mesAnterior, mesesAnio, labelMesAnterior: nombreMes(mesAnterior), rango, rangoAnioAnterior, diaCorte };
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
