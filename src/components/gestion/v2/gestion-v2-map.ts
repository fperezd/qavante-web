/* Mapper PURO de Gestión v2 (sin React): deriva desde `OperationalResultResponse` (un mes) y
   `OperationalResultBreakdown` (la serie por rango) los insumos de la vista v2 — hero, márgenes,
   comparativos, cascada, drivers y la tendencia de margen. Todo sale del contrato que ya existe;
   no inventa datos. Montos string-decimal (se parsean con `parseAmount`).

   Contrato: la cascada foota a `result` (Ingresos − Costos directos − Gasto laboral − Honorarios
   − Gastos recurrentes = Resultado operacional). El margen neto mostrado es el OPERACIONAL
   (result / revenue); el neto real (post impuestos/financieros) requiere líneas que el backend
   aún no manda (brecha abierta). */

import type {
  OperationalResultResponse,
  OperationalResultVariation,
  OperationalResultBreakdown,
  BreakdownRow,
} from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";
import type { CascadaEntrada } from "./cascada-model";
import type { DriverItem } from "./drivers-resultado";
import type { TendenciaPunto } from "./tendencia-resultado";
import type { ResultadoTono } from "./resultado-hero";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-07" → "jul". Tolera "YYYY-MM" y "YYYY-MM-DD". */
export function mesCorto(period: string): string {
  const m = period.match(/^\d{4}-(\d{2})/);
  const idx = m ? Number(m[1]) - 1 : NaN;
  return MESES[idx] ?? period;
}

/** Margen operacional % = resultado / ingresos * 100 (0 si no hay ingresos). */
export function margenOperacionalPct(resp: OperationalResultResponse): number {
  const rev = parseAmount(resp.revenue);
  if (rev === 0) return 0;
  return (parseAmount(resp.result) / rev) * 100;
}

export interface HeroData {
  titulo: string;
  resultado: number;
  respuesta: string;
  respuestaTono: ResultadoTono;
}

/** Hero "respuesta de dueño": ganó/perdió + cuánto mejor/peor que el mes pasado. */
export function mapHero(resp: OperationalResultResponse): HeroData {
  const resultado = parseAmount(resp.result);
  const gano = resultado >= 0;
  const { texto, tono } = fraseVariacion(resp.variation.vs_previous_month, gano);
  return {
    titulo: gano ? "El negocio ganó este mes" : "El negocio perdió este mes",
    resultado,
    respuesta: texto,
    respuestaTono: tono,
  };
}

/** Frase de la variación vs. mes anterior ("12,5% mejor que el mes pasado"). */
function fraseVariacion(v: OperationalResultVariation | null, gano: boolean): { texto: string; tono: ResultadoTono } {
  if (!v) return { texto: "Primer mes con datos comparables.", tono: gano ? "ok" : "bad" };
  const pct = parseAmount(v.pct);
  const mejor = pct >= 0;
  return {
    texto: `${fmtPct(Math.abs(pct))} ${mejor ? "mejor" : "peor"} que el mes pasado`,
    tono: mejor ? "ok" : "bad",
  };
}

export interface Comparativo {
  label: string;
  pct: number;
}

/** Comparativos del ritmo que EXISTEN en el contrato (vs mes anterior, vs mismo mes año
 *  anterior). El "vs promedio" no está en el contrato → se omite (degradación honesta). */
export function mapComparativos(resp: OperationalResultResponse): Comparativo[] {
  const out: Comparativo[] = [];
  const { vs_previous_month, vs_same_month_last_year } = resp.variation;
  if (vs_previous_month) out.push({ label: "vs. mes anterior", pct: parseAmount(vs_previous_month.pct) });
  if (vs_same_month_last_year) out.push({ label: "vs. mismo mes año anterior", pct: parseAmount(vs_same_month_last_year.pct) });
  return out;
}

/** La cascada del P&L: Ingresos → −Costos → Margen bruto → −gastos → Resultado operacional. */
export function mapCascada(resp: OperationalResultResponse): CascadaEntrada[] {
  const abs = (s: string) => Math.abs(parseAmount(s));
  return [
    { id: "ingresos", label: "Ingresos", tipo: "ingreso", monto: parseAmount(resp.revenue) },
    { id: "costos", label: "Costos directos", tipo: "resta", monto: abs(resp.direct_cost) },
    { id: "margen-bruto", label: "Margen bruto", tipo: "subtotal", monto: 0, pct: parseAmount(resp.gross_margin_pct) },
    { id: "laboral", label: "Gasto laboral", tipo: "resta", monto: abs(resp.labor_cost) },
    { id: "honorarios", label: "Honorarios", tipo: "resta", monto: abs(resp.professional_fees) },
    { id: "gastos", label: "Gastos recurrentes", tipo: "resta", monto: abs(resp.recurring_expenses) },
    { id: "resultado", label: "Resultado operacional", tipo: "resultado", monto: 0, pct: margenOperacionalPct(resp) },
  ];
}

/** Drivers "qué explica el resultado". */
export function mapDrivers(resp: OperationalResultResponse): DriverItem[] {
  return resp.drivers.map((d, i) => ({
    id: `${d.concept}-${i}`,
    direccion: d.direction,
    concepto: d.concept,
    impacto: parseAmount(d.impact),
    explicacion: d.explanation,
  }));
}

/** Tendencia del MARGEN operacional por mes, desde el breakdown por rango. Busca la fila
 *  subtotal del resultado (por key/label), y usa su `pct_by_month` (margen) + `by_month` ($).
 *  Degrada a [] si no encuentra la fila o faltan los %. */
export function mapTendencia(bd: OperationalResultBreakdown): TendenciaPunto[] {
  const fila = filaResultado(bd.rows);
  if (!fila || !fila.pct_by_month) return [];
  const pct = fila.pct_by_month;
  const montos = fila.by_month;
  return bd.months.map((mes, i) => ({
    periodo: mesCorto(mes),
    margenPct: parseAmount(pct[i] ?? "0"),
    resultado: parseAmount(montos[i] ?? "0"),
    actual: bd.proforma_month != null && mes === bd.proforma_month,
  }));
}

/** Encuentra la fila subtotal del resultado operacional (aplana el árbol). Heurística por key
 *  o label; si no hay match, cae al último subtotal (el más abajo del P&L = el resultado). */
function filaResultado(rows: BreakdownRow[]): BreakdownRow | null {
  const planas: BreakdownRow[] = [];
  const aplanar = (rs: BreakdownRow[]) => {
    for (const r of rs) {
      planas.push(r);
      if (r.children?.length) aplanar(r.children);
    }
  };
  aplanar(rows);
  const subtotales = planas.filter((r) => r.kind === "subtotal");
  const match = subtotales.find((r) => /result|operac/i.test(`${r.key} ${r.label}`));
  return match ?? subtotales[subtotales.length - 1] ?? null;
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
