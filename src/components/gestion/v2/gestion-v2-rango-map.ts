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

/** ¿El período BASE de una comparación está incompleto? Señal: tiene ingresos y margen bruto, pero
 *  los gastos (bruto − resultado) son casi nulos (< 5% del margen bruto). Ninguna empresa operando
 *  (con planilla, arriendo, etc.) tiene gastos < 5% del bruto → los costos/gastos NO están cargados,
 *  y por eso su RESULTADO sale inflado y NO es comparable (ej.: un año viejo sin remuneraciones →
 *  "resultado −46%" falso). Puro/testeable. Solo aplica al resultado; ingresos y bruto sí comparan. */
export function baseIncompleta(ingresos: number, bruto: number, neto: number): boolean {
  if (ingresos <= 0 || bruto <= 0) return false;
  return bruto - neto < 0.05 * bruto;
}

/** `baseIncompleta` sobre el resumen de un rango (Acumulado/Trimestre). */
export function rangoIncompleto(r: RangoResumen | null): boolean {
  return r ? baseIncompleta(r.ingresos, r.bruto.monto, r.neto.monto) : false;
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
  const r = mapRangoResumen(bd);
  if (r.ingresos <= 0) return true; // otro caso (vacío/parcial)
  // Agregado: resultado del período > ingresos (imposible). Y por mes: algún margen > 100%
  // (mismo bug de costos en $0). Cualquiera de los dos ⇒ no confiable.
  return r.neto.monto <= r.ingresos && tendenciaConfiable(r.tendencia);
}
