/* Mapper PURO de la vista de RANGO de Gestión v2 (sin React): deriva desde el breakdown por
   rango (meses en columnas) el resumen del período — resultado acumulado, márgenes bruto/neto
   ($ y %), mejor mes y la tendencia del margen. Reusa `mapTendencia`/`mesCorto` de gestion-v2-map.
   Todo sale del contrato que ya existe (OperationalResultBreakdown). */

import type { OperationalResultBreakdown, BreakdownRow } from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";
import { mapTendencia, tendenciaConfiable } from "./gestion-v2-map";
import type { TendenciaPunto } from "./tendencia-resultado";

/* Avisos del cálculo (`OperationalResultBreakdown.warnings`, CC-API #691): el backend marca cuándo el
   resultado puede estar distorsionado (ej. ingresos de productos sin costo de venta → margen inflado).
   Traducimos el código a lenguaje de dueño; el desconocido se muestra tal cual (no inventamos). */
const WARNING_LABEL: Record<string, string> = {
  product_income_without_cogs:
    "Hay ingresos de productos sin costo de venta asociado, así que el margen puede verse más alto de lo real.",
};
export function warningLabel(code: string): string {
  return WARNING_LABEL[code.trim()] ?? code;
}

/* Códigos de `warnings` que significan que el MARGEN está distorsionado (inflado) — el resultado no es
   confiable para mostrarlo como cifra. Es la señal honesta del backend para el caso "faltan costos"
   (ej. ingresos de productos sin costo de venta): el margen ≤ 100% no lo atrapa, pero el backend sí lo
   avisa. Cubre el caso COGS-en-cero; el "faltan SOLO las remuneraciones" necesita un warning nuevo o
   costos por línea (escalado a CC-API, issue #734). */
const WARNINGS_DISTORSION = new Set(["product_income_without_cogs"]);

/** ¿El backend avisó que el margen del período está distorsionado (inflado por costos faltantes)? */
export function margenDistorsionado(bd: OperationalResultBreakdown): boolean {
  return (bd.warnings ?? []).some((w) => WARNINGS_DISTORSION.has(w.trim()));
}

/** Aplana el árbol de filas del breakdown (secciones con hijos → lista). */
function aplanar(rows: BreakdownRow[]): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  const rec = (rs: BreakdownRow[]) => {
    for (const r of rs) {
      out.push(r);
      if (r.children?.length) rec(r.children);
    }
  };
  rec(rows);
  return out;
}

/** Última fila (subtotal/sección) que matchea el regex por key+label (la de más abajo del P&L). */
function ultimaFila(flat: BreakdownRow[], re: RegExp): BreakdownRow | null {
  const hits = flat.filter(
    (r) => (r.kind === "subtotal" || r.kind === "section") && re.test(`${r.key} ${r.label}`),
  );
  return hits[hits.length - 1] ?? null;
}

/** Último subtotal del P&L (fallback del resultado cuando el breakdown no rotula "Resultado"). */
function ultimoSubtotal(flat: BreakdownRow[]): BreakdownRow | null {
  const subs = flat.filter((r) => r.kind === "subtotal");
  return subs[subs.length - 1] ?? null;
}

export interface Margen {
  monto: number;
  pct: number;
}

export interface RangoResumen {
  /** Ingresos acumulados del período. */
  ingresos: number;
  /** Margen bruto acumulado ($ y %). */
  bruto: Margen;
  /** Margen neto (resultado operacional) acumulado ($ y %). */
  neto: Margen;
  /** Mejor mes por margen (para el insight), si hay tendencia. */
  mejorMes: { periodo: string; pct: number } | null;
  /** Serie del margen por mes (para el gráfico central). */
  tendencia: TendenciaPunto[];
  /** Etiqueta corta del rango, ej. "may–jul". */
  rangoLabel: string;
}

const pctDe = (fila: BreakdownRow | null, ingresos: number): number => {
  if (!fila) return 0;
  if (fila.pct_total != null) return parseAmount(fila.pct_total);
  const monto = parseAmount(fila.total);
  return ingresos > 0 ? (monto / ingresos) * 100 : 0;
};

/** Resumen del período a partir del breakdown. */
export function mapRangoResumen(bd: OperationalResultBreakdown): RangoResumen {
  const flat = aplanar(bd.rows ?? []);
  const ingresosFila = ultimaFila(flat, /income|ingreso/i);
  const brutoFila = ultimaFila(flat, /gross.?margin|margen.?brut/i);
  // Resultado operacional: la fila rotulada; si el breakdown no la trae, el último subtotal (el
  // fondo del P&L) es el mejor proxy del resultado disponible.
  const netoFila = ultimaFila(flat, /operational.?result|resultad/i) ?? ultimoSubtotal(flat);

  const ingresos = parseAmount(ingresosFila?.total);
  const tendencia = mapTendencia(bd);
  const mejorMes =
    tendencia.length > 0
      ? tendencia.reduce((best, p) => (p.margenPct > best.margenPct ? p : best))
      : null;

  const meses = bd.months ?? [];
  const rangoLabel =
    meses.length > 0 ? `${mesCortoDe(meses[0]!)}–${mesCortoDe(meses[meses.length - 1]!)}` : "";

  return {
    ingresos,
    bruto: { monto: parseAmount(brutoFila?.total), pct: pctDe(brutoFila, ingresos) },
    neto: { monto: parseAmount(netoFila?.total), pct: pctDe(netoFila, ingresos) },
    mejorMes: mejorMes ? { periodo: mejorMes.periodo, pct: mejorMes.margenPct } : null,
    tendencia,
    rangoLabel,
  };
}

/** ¿El período BASE de una comparación tiene los gastos SIN cargar (resultado inflado, no comparable)?
 *  El problema (ej.: un año viejo sin remuneraciones → "−46%" falso) es que su intensidad de gasto es
 *  ínfima. Pero un umbral absoluto (ej. "<5% del bruto") daría FALSO POSITIVO en una micro-PYME lean
 *  real (dueño sin planilla, gastos genuinamente bajos) — el target exacto de Qavante. Por eso se
 *  compara contra la ESTRUCTURA DE COSTOS del período de referencia (el año/rango actual, mismo
 *  negocio): la base está incompleta si su gasto/bruto es una fracción ínfima del de la referencia,
 *  y SOLO si la referencia sí incurre gastos materiales (si el negocio es lean en ambos, no se marca).
 *  Puro/testeable. Solo aplica al resultado; ingresos y bruto sí comparan. */
export function baseIncompleta(
  baseBruto: number,
  baseNeto: number,
  refBruto: number,
  refNeto: number,
): boolean {
  if (baseBruto <= 0) return false;
  const baseRatio = (baseBruto - baseNeto) / baseBruto; // gastos como fracción del margen bruto
  if (refBruto <= 0) return baseRatio < 0.05; // sin referencia → umbral absoluto conservador
  const refRatio = (refBruto - refNeto) / refBruto;
  // La referencia debe tener gasto material (≥10% del bruto) para ser un patrón válido; y la base,
  // menos de 1/3 de esa intensidad → sus gastos "no están ahí" comparados con el mismo negocio hoy.
  return refRatio >= 0.1 && baseRatio < 0.3 * refRatio;
}

/** `baseIncompleta` sobre el resumen de un rango (Acumulado/Trimestre), contra un rango de referencia
 *  (típicamente el acumulado del año actual = la foto más completa de cuánto gasta el negocio). */
export function rangoIncompleto(base: RangoResumen | null, ref: RangoResumen | null): boolean {
  if (!base) return false;
  return baseIncompleta(
    base.bruto.monto,
    base.neto.monto,
    ref?.bruto.monto ?? 0,
    ref?.neto.monto ?? 0,
  );
}

/** "2026-07" → "jul" (local para no exportar de más; equivalente a mesCorto). */
function mesCortoDe(period: string): string {
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const m = period.match(/^\d{4}-(\d{2})/);
  const idx = m ? Number(m[1]) - 1 : NaN;
  return MESES[idx] ?? period;
}

/** ¿El resultado del período es plausible para mostrarlo con confianza? Mismo criterio que el
 *  mes (el rango corre sobre el mismo cálculo): resultado > ingresos ⇒ margen > 100% ⇒ imposible. */
export function rangoConfiable(bd: OperationalResultBreakdown): boolean {
  // El backend avisó que el margen está inflado (costos faltantes) → no confiable, aunque el margen
  // dé ≤ 100% (issue #734: un mes con costos parciales en $0 y margen 92% se colaba como confiable).
  if (margenDistorsionado(bd)) return false;
  const r = mapRangoResumen(bd);
  if (r.ingresos <= 0) return true; // otro caso (vacío/parcial)
  // Agregado: resultado del período > ingresos (imposible). Y por mes: algún margen > 100%
  // (mismo bug de costos en $0). Cualquiera de los dos ⇒ no confiable.
  return r.neto.monto <= r.ingresos && tendenciaConfiable(r.tendencia);
}
