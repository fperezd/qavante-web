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
import { parseAmount, formatSignedPct } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
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

/** ¿El resultado operacional es plausible como para MOSTRARLO con confianza? Única implausibilidad
 *  DURA: `result` ≥ `revenue` ⇒ margen ≥ 100% ⇒ los costos netos del mes fueron ≤ 0, imposible
 *  operacionalmente (típico: un gasto se revierte o llega mal clasificado y el resultado queda
 *  inflado por encima de los ingresos). En ese caso degradamos honesto (§13).
 *
 *  Lo que NO hacemos (y antes sí, mal): exigir costos en los buckets `direct_cost`/`labor_cost`/
 *  `professional_fees`. Una empresa de servicios (p. ej. Tooxs) los tiene legítimamente en $0 —
 *  sus costos viven en `recurring_expenses` — y el backend lo avisa en `missing_sources`
 *  ("agrupado en recurring_expenses") con `data_state: available`. Confiar en esos buckets
 *  degradaba TODOS los meses de una empresa de servicios y mostraba un "$0 de costos" falso.
 *  Para la calidad del dato confiamos en `confidence`/`missing_sources` (los surface el pie). */
export function resultadoConfiable(resp: OperationalResultResponse): boolean {
  const rev = parseAmount(resp.revenue);
  if (rev <= 0) return true; // sin ingresos = otro caso (vacío/parcial), esta guarda no aplica
  // Resultado ≥ ingresos ⇒ margen ≥ 100% ⇒ costos netos ≤ 0 ⇒ imposible operacionalmente.
  if (parseAmount(resp.result) >= rev) return false;
  return true;
}

/** ¿Se puede mostrar la barra "De cada $100" sin que se desborde? Necesita: ingresos>0, resultado en
 *  [0, margen bruto] Y margen bruto ≤ ingresos. Si el bruto SUPERA los ingresos (COGS negativo por una
 *  reversa de NC), el costo de ventas se clampea a 0 pero gastos/queda usan el bruto crudo → los tres
 *  tramos sumarían >100% y la barra se sale del riel. En ese caso, degradar honesto (no mostrarla). */
export function deCada100Confiable(resp: OperationalResultResponse): boolean {
  const rev = parseAmount(resp.revenue);
  const bruto = parseAmount(resp.gross_margin);
  const neto = parseAmount(resp.result);
  return rev > 0 && neto >= 0 && bruto >= neto && bruto <= rev;
}

/** Margen operacional % = resultado / ingresos * 100 (0 si no hay ingresos positivos: con
 *  revenue ≤ 0 el % no tiene sentido y dividir invertiría el signo). */
export function margenOperacionalPct(resp: OperationalResultResponse): number {
  const rev = parseAmount(resp.revenue);
  if (rev <= 0) return 0;
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
  // `variation` puede faltar en respuestas parciales/estimadas → guard (no crashear la vista).
  const { texto, tono } = fraseVariacion(resp.variation?.vs_previous_month ?? null, gano);
  return {
    titulo: gano ? "El negocio ganó este mes" : "El negocio perdió este mes",
    resultado,
    respuesta: texto,
    respuestaTono: tono,
  };
}

/** `+$1.234.567` / `−$1.234.567` — el monto con signo explícito, para la comparación mes a mes. */
function montoConSigno(v: number): string {
  return `${v >= 0 ? "+" : "−"}${formatClp(Math.abs(v))}`;
}

/** Frase de la variación vs. mes anterior. Lidera con el MONTO, no con el %: un % sobre un mes base
 *  chico explota ("+442%") y engaña; el peso ("$13,7M mejor que el mes pasado") siempre es honesto. */
function fraseVariacion(
  v: OperationalResultVariation | null,
  gano: boolean,
): { texto: string; tono: ResultadoTono } {
  if (!v) return { texto: "Primer mes con datos comparables.", tono: gano ? "ok" : "bad" };
  const amount = parseAmount(v.amount);
  const mejor = amount >= 0;
  return {
    texto: `${formatClp(Math.abs(amount))} ${mejor ? "mejor" : "peor"} que el mes pasado`,
    tono: mejor ? "ok" : "bad",
  };
}

export interface Comparativo {
  label: string;
  /** Ya formateado: monto con signo (mes a mes) o % (año contra año). */
  texto: string;
  positivo: boolean;
}

/** Comparativos del ritmo que EXISTEN en el contrato. Honestidad de la métrica: el "vs mes anterior"
 *  va en MONTO (el % explota sobre bases chicas), y el "vs mismo mes año anterior" va en % (base
 *  estable, es la señal de tendencia real). El "vs promedio" no está en el contrato → se omite. */
export function mapComparativos(resp: OperationalResultResponse): Comparativo[] {
  const out: Comparativo[] = [];
  const { vs_previous_month, vs_same_month_last_year } = resp.variation ?? {};
  if (vs_previous_month) {
    const amount = parseAmount(vs_previous_month.amount);
    out.push({ label: "vs. mes anterior", texto: montoConSigno(amount), positivo: amount >= 0 });
  }
  if (vs_same_month_last_year) {
    const pct = parseAmount(vs_same_month_last_year.pct);
    out.push({
      label: "vs. mismo mes año anterior",
      texto: formatSignedPct(String(pct)),
      positivo: pct >= 0,
    });
  }
  return out;
}

/** La cascada del P&L: Ingresos → −Costos → Margen bruto → −gastos → Resultado operacional.
 *  Si las 5 líneas no footean al `result` del backend (hay otras partidas no desglosadas), se
 *  inserta una línea "Otros" (ajuste FIRMADO) para que la barra del resultado coincida SIEMPRE
 *  con el resultado del hero — nunca dos cifras contradictorias en la misma pantalla. */
export function mapCascada(resp: OperationalResultResponse): CascadaEntrada[] {
  const abs = (s: string) => Math.abs(parseAmount(s));
  const revenue = parseAmount(resp.revenue);
  const dc = abs(resp.direct_cost);
  const lc = abs(resp.labor_cost);
  const pf = abs(resp.professional_fees);
  const re = abs(resp.recurring_expenses);
  const derivado = revenue - dc - lc - pf - re;
  const ajuste = parseAmount(resp.result) - derivado; // firmado; ~0 si las líneas ya footean

  const entradas: CascadaEntrada[] = [
    { id: "ingresos", label: "Ingresos", tipo: "ingreso", monto: revenue },
    { id: "costos", label: "Costos directos", tipo: "resta", monto: dc },
    {
      id: "margen-bruto",
      label: "Margen bruto",
      tipo: "subtotal",
      monto: 0,
      pct: parseAmount(resp.gross_margin_pct),
    },
    { id: "laboral", label: "Gasto laboral", tipo: "resta", monto: lc },
    { id: "honorarios", label: "Honorarios", tipo: "resta", monto: pf },
    { id: "gastos", label: "Gastos recurrentes", tipo: "resta", monto: re },
  ];
  // Solo si el desvío es material (≥ $1) para no ensuciar la cascada con un "Otros" de $0.
  if (Math.abs(ajuste) >= 1) {
    entradas.push({ id: "otros", label: "Otros", tipo: "ajuste", monto: ajuste });
  }
  entradas.push({
    id: "resultado",
    label: "Resultado operacional",
    tipo: "resultado",
    monto: 0,
    pct: margenOperacionalPct(resp),
  });
  return entradas;
}

/** Drivers "qué explica el resultado". */
export function mapDrivers(resp: OperationalResultResponse): DriverItem[] {
  return (resp.drivers ?? []).map((d, i) => ({
    id: `${d.concept}-${i}`,
    direccion: d.direction,
    concepto: d.concept,
    impacto: parseAmount(d.impact),
    explicacion: d.explanation,
  }));
}

/** ¿La serie de márgenes es plausible? Un margen > 100% es imposible (resultado > ingresos ⇒
 *  costos faltantes). Si algún mes es implausible, la tendencia entera es sospechosa (mismo bug
 *  de datos del backend) → no se muestra. */
export function tendenciaConfiable(puntos: TendenciaPunto[]): boolean {
  return puntos.every((p) => p.margenPct <= 100);
}

/** Veredicto de deterioro/mejora del margen: compara el margen del primer mes de la ventana vs el
 *  último. `null` si hay <2 puntos o el cambio es inmaterial (< `umbralPp` puntos porcentuales) →
 *  no se muestra alerta (evita ruido en meses estables). PURO. */
export interface VeredictoMargen {
  baja: boolean;
  deltaPp: number;
  desde: number;
  hasta: number;
  meses: number;
}
export function evaluarTendenciaMargen(
  puntos: TendenciaPunto[],
  umbralPp = 3,
): VeredictoMargen | null {
  if (puntos.length < 2) return null;
  const desde = puntos[0]!.margenPct;
  const hasta = puntos[puntos.length - 1]!.margenPct;
  const deltaPp = hasta - desde;
  if (Math.abs(deltaPp) < umbralPp) return null;
  return { baja: deltaPp < 0, deltaPp, desde, hasta, meses: puntos.length - 1 };
}

/** Tendencia del MARGEN operacional por mes, desde el breakdown por rango. Busca la fila
 *  subtotal del resultado (por key/label), y usa su `pct_by_month` (margen) + `by_month` ($).
 *  Degrada a [] si no encuentra la fila o faltan los %. */
export function mapTendencia(bd: OperationalResultBreakdown): TendenciaPunto[] {
  const fila = filaResultado(bd.rows);
  if (!fila || !fila.pct_by_month) return [];
  const pct = fila.pct_by_month;
  const montos = fila.by_month;
  // Alineación: los tres arrays deben tener el largo de `months`. Si el backend manda una fila
  // con menos entradas, indexar posicional desalinearía los meses (o rellenaría 0 en silencio)
  // → degradamos a [] en vez de mostrar una tendencia corrida.
  if (pct.length !== bd.months.length || montos.length !== bd.months.length) return [];
  return bd.months.map((mes, i) => ({
    periodo: mesCorto(mes),
    periodoFull: mes,
    margenPct: parseAmount(pct[i]),
    resultado: parseAmount(montos[i]),
    actual: bd.proforma_month != null && mes === bd.proforma_month,
  }));
}

/** Separa la tendencia del margen en meses CERRADOS (comparables) y el mes EN CURSO (parcial). El
 *  margen de un mes a medio andar (ej. día 3) es basura estadística: costos mensuales casi completos
 *  contra unas pocas ventas → un −1443% que NO es "el peor mes", solo que el mes todavía no cierra.
 *  El mejor/peor mes, el promedio y la tendencia se calculan sobre los CERRADOS; el en curso se
 *  muestra aparte (nota "va en curso"), nunca como punto comparable. PURO. */
export function separarMesEnCurso(puntos: TendenciaPunto[]): {
  cerrados: TendenciaPunto[];
  enCurso: TendenciaPunto | null;
} {
  const enCurso = puntos.find((p) => p.actual) ?? null;
  return { cerrados: puntos.filter((p) => !p.actual), enCurso };
}

/** Encuentra la fila subtotal del resultado operacional (aplana el árbol). Prefiere un match
 *  específico de "resultado"; si no, el último subtotal que matchee /result|operac/; y en
 *  última instancia el último subtotal del P&L (el más abajo = el resultado). */
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
  // "resultado" es más específico que "operac" (evita agarrar "Margen operacional" antes que
  // "Resultado operacional"); si hay varios, el ÚLTIMO (el resultado va al fondo del P&L).
  const resultRows = subtotales.filter((r) => /resultad|\bresult\b/i.test(`${r.key} ${r.label}`));
  if (resultRows.length) return resultRows[resultRows.length - 1]!;
  const operacRows = subtotales.filter((r) => /operac/i.test(`${r.key} ${r.label}`));
  if (operacRows.length) return operacRows[operacRows.length - 1]!;
  return subtotales[subtotales.length - 1] ?? null;
}
