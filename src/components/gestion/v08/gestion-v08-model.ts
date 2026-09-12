import { exportTable, type ExportTable } from "@/lib/export/table";
/* V08 · Gestión — modelo PURO (sin React, sin DOM → testeable en vitest unit).
 *
 * La spec (§V08) unifica NUEVE páginas en UNA vista de SEIS tabs. Todo lo que decide qué número
 * sale de dónde vive acá; la vista sólo pinta.
 *
 * ── LEY 1, medida y no prometida ──────────────────────────────────────────────
 * "Resultado del mes" tiene DOS motores vivos en el contrato:
 *
 *   (A) `GET /api/dashboard/summary` → `operational_result.result` — lo que publica V01 · Hoy en
 *       su strip de indicadores (`indicadoresHoy` de `hoy-model.ts`).
 *   (B) `GET /api/management/operational-result/breakdown` → la fila subtotal del árbol de cuentas,
 *       que el contrato promete que "cuadra con `/api/treasury/reports/operational-result` por
 *       construcción".
 *
 * Esta vista NO elige uno en silencio. El titular del tab Resultado publica (A) — el MISMO número
 * que V01, por definición, porque sale del mismo campo del mismo endpoint (`resultadoDelMes`). El
 * pivote publica (B), que es el único que se abre por cuenta y por mes. Y `chequeoLey1` compara
 * los dos: si difieren más de $1, la pantalla lo DICE con los dos números y sus fuentes en vez de
 * mostrar dos verdades en dos tabs. El antecedente es `qavante-api#108` (dos motores de P&L
 * difiriendo en $60,6M): la respuesta a dos fuentes no es taparlas, es medirlas.
 *
 * ── LA REGLA DE ORO DEL COMPARATIVO ───────────────────────────────────────────
 * El mes en curso se compara SIEMPRE contra el mes anterior a la MISMA ALTURA. El corte al día lo
 * hace el backend (`/al-dia?period&hasta_dia`), no el front recortando una serie mensual. El mes
 * anterior COMPLETO se trae del MISMO endpoint (`hasta_dia = 31`) para que la columna gris de
 * referencia hable el mismo idioma (flujo RCV) que las dos que se comparan — mezclarla con el
 * `operational-result` del mes (que sí incluye nómina y honorarios) sería poner tres definiciones
 * distintas en tres columnas vecinas. El delta se calcula SIEMPRE contra la misma altura.
 */

import type {
  BreakdownRow,
  OperationalResultAlDia,
  OperationalResultBreakdown,
  OperationalResultDocuments,
  OperationalResultResponse,
} from "@/lib/api/gestion";
import type { CashCycleResponse } from "@/lib/api/treasury";
import type { DashboardSummaryResponse } from "@/lib/api/dashboard";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";
import { csv, csvCell } from "@/lib/export/csv";
import { montoDocEnCuenta, shiftPeriod } from "../gestion-format";
import { computePuntoEquilibrio } from "../v2/punto-equilibrio-model";
import {
  agregarContrapartes,
  concentracionPct,
  estacionalidad,
  montoFirmado,
  periodoDe,
  serieMensual,
  sinMesEnCurso,
} from "../v2/contraparte-360-model";
import type { DocConVencimiento } from "@/components/terminos/terminos-pago";
import { isNotaCredito } from "@/components/sii/tipo-doc";
import { comparePeriod } from "@/lib/period/period-range";
import { normalizeRut } from "@/lib/validators/rut";

/* ────────────────────────── Tabs y rutas ────────────────────────── */

export const TABS_V08 = [
  "resultado",
  "margenes",
  "tendencia",
  "comparativo",
  "clientes",
  "proveedores",
] as const;

export type TabV08 = (typeof TABS_V08)[number];

export const TAB_LABEL: Record<TabV08, string> = {
  resultado: "Resultado",
  margenes: "Márgenes",
  tendencia: "Tendencia",
  comparativo: "Comparativo",
  clientes: "Clientes 360",
  proveedores: "Proveedores 360",
};

/** Una pantalla, una pregunta (Ley 10) — pero seis tabs, seis preguntas del mismo tema. */
export const TAB_PREGUNTA: Record<TabV08, string> = {
  resultado: "¿Gano o pierdo?",
  margenes: "¿Cuánto te queda de cada peso que vendes?",
  tendencia: "¿Cómo viene tu margen mes a mes?",
  comparativo: "¿Cómo vas este mes contra el anterior?",
  clientes: "¿Cómo se comporta cada cliente?",
  proveedores: "¿Cómo se comporta cada proveedor?",
};

/* Las OCHO sub-rutas que hoy son páginas propias y con el flag encendido se vuelven una tab.
   Costos y gastos entra como SECCIÓN del Resultado expandido; Ciclo de caja y Punto de equilibrio
   como BLOQUE dentro de Márgenes (spec §V08 + HTML 08·D). Por eso tres rutas caen en dos tabs y
   no hay ninguna ruta huérfana: el mapa es total sobre las nueve páginas (la novena es la raíz
   `/gestion`, que es la vista misma).

   `/gestion/pulso` y `/gestion/salud` NO están acá a propósito: son V10 (Alertas) y la pantalla
   Salud, no V08 — redirigirlas sería tragarse dos vistas ajenas en este PR. */
export const RUTAS_VIEJAS_V08: Readonly<Record<string, TabV08>> = {
  "/gestion/margenes": "margenes",
  "/gestion/tendencia": "tendencia",
  "/gestion/comparativo": "comparativo",
  "/gestion/costos": "resultado",
  "/gestion/ciclo-de-caja": "margenes",
  "/gestion/punto-equilibrio": "margenes",
  "/gestion/clientes": "clientes",
  "/gestion/proveedores": "proveedores",
};

/** Ancla dentro de la tab a la que aterriza cada ruta vieja (para no dejar al usuario mirando
 *  otra sección). `null` = la tab entera es el destino. */
export const ANCLA_RUTA_VIEJA: Readonly<Record<string, string | null>> = {
  "/gestion/costos": "costos",
  "/gestion/ciclo-de-caja": "ciclo",
  "/gestion/punto-equilibrio": "equilibrio",
};

/** `?tab=` → tab válida. Cualquier cosa rara cae en Resultado (la pregunta principal). */
export function tabDesdeQuery(raw: string | null | undefined): TabV08 {
  return TABS_V08.includes(raw as TabV08) ? (raw as TabV08) : "resultado";
}

/** Ruta vieja → destino con el flag ENCENDIDO. `null` si la ruta no es de V08. */
export function destinoRutaVieja(ruta: string): string | null {
  const tab = RUTAS_VIEJAS_V08[ruta];
  if (!tab) return null;
  const ancla = ANCLA_RUTA_VIEJA[ruta];
  return `/gestion?tab=${tab}${ancla ? `#${ancla}` : ""}`;
}

/* ────────────────────────── Ley 1 ────────────────────────── */

/** El "Resultado mes" QUE PUBLICA V01 · Hoy: `operational_result.result` del summary, el MISMO
 *  campo que lee `indicadoresHoy`. Es la definición de la casa para este concepto; V08 no la
 *  recalcula ni la sustituye por otra fuente. `null` = no llegó (nunca 0). */
export function resultadoDelMes(s: DashboardSummaryResponse | null | undefined): number | null {
  return s?.operational_result ? parseAmountOrNull(s.operational_result.result) : null;
}

/** Tolerancia de la comparación: el redondeo al peso de dos motores distintos puede diferir en
 *  centavos. Un peso de diferencia todavía es "el mismo número"; dos ya no. */
export const TOLERANCIA_LEY1_CLP = 1;

export interface ChequeoLey1 {
  /** El número de V01 (`/api/dashboard/summary`). */
  v01: number | null;
  /** El mismo concepto según el pivote (`/breakdown`, fila subtotal del resultado). */
  pivote: number | null;
  /** Mes sobre el que se comparó ("YYYY-MM"); `null` si no se pudo determinar. */
  periodo: string | null;
  /** |v01 − pivote|; `null` si falta alguno de los dos. */
  diferencia: number | null;
  /** Los dos existen y difieren por encima de la tolerancia → hay que DECLARARLO. */
  divergen: boolean;
}

/** Compara los dos motores del mismo concepto. No elige: informa. */
export function chequeoLey1(
  v01: number | null,
  pivote: number | null,
  periodo: string | null,
): ChequeoLey1 {
  const diferencia = v01 != null && pivote != null ? Math.abs(v01 - pivote) : null;
  return {
    v01,
    pivote,
    periodo,
    diferencia,
    divergen: diferencia != null && diferencia > TOLERANCIA_LEY1_CLP,
  };
}

/* ────────────────────────── Pivote del Resultado ────────────────────────── */

/** Claves de las filas subtotal del breakdown que son "el resultado del mes". El backend publica
 *  el árbol con `kind:"subtotal"`; la clave canónica es `result`, pero históricamente convivió
 *  `resultado`. Se listan explícitas (nunca por heurística sobre el label). */
const CLAVES_RESULTADO = new Set(["result", "resultado", "net_result", "operational_result"]);
const CLAVES_INGRESO = new Set(["income", "revenue", "ingresos"]);

export interface CeldaPivote {
  periodo: string;
  /** `null` = la fila no publica ese mes (serie desalineada) — nunca 0 inventado. */
  monto: number | null;
}

export interface FilaPivote {
  key: string;
  label: string;
  kind: string;
  /** 0 = sección / subtotal; 1 = cuenta (subcategoría). */
  nivel: number;
  celdas: CeldaPivote[];
  total: number;
  /** Variación del ÚLTIMO mes contra el anterior, en %. `null` si no hay base (mes previo 0). */
  variacionPct: number | null;
  /** `documentos` = se abre hasta el documento (endpoint por cuenta). `hijos` = despliega sus
   *  subcategorías, que ya vienen en la misma respuesta. `ninguno` = fila de cierre. */
  drill: "documentos" | "hijos" | "ninguno";
  hijos: FilaPivote[];
}

function celdasDe(row: BreakdownRow, months: string[]): CeldaPivote[] {
  const bm = row.by_month ?? [];
  /* Serie desalineada con las columnas: no se rellena con ceros. Un cero inventado en una grilla
     de plata es indistinguible de un mes real sin movimiento. */
  const alineada = bm.length === months.length;
  return months.map((periodo, i) => ({
    periodo,
    monto: alineada ? parseAmount(bm[i]) : null,
  }));
}

/** Variación % del último mes contra el anterior. `null` si falta alguno o si la base es 0
 *  (dividir por cero daría Infinity, y un "+∞%" no es una lectura). */
export function variacionUltimoMes(celdas: CeldaPivote[]): number | null {
  if (celdas.length < 2) return null;
  const ult = celdas[celdas.length - 1]?.monto;
  const prev = celdas[celdas.length - 2]?.monto;
  if (ult == null || prev == null || prev === 0) return null;
  return ((ult - prev) / Math.abs(prev)) * 100;
}

/** El árbol del breakdown → filas del pivote (secciones con sus cuentas como hijos).
 *  Sólo DOS niveles: la spec pide "▾ subcategoría → filas .exp con folio + contraparte", o sea
 *  sección → cuenta → documento. Un tercer nivel de agregado no existe en el contrato. */
export function filasPivote(bd: OperationalResultBreakdown | null | undefined): FilaPivote[] {
  if (!bd) return [];
  const months = bd.months ?? [];
  const out: FilaPivote[] = [];

  for (const row of bd.rows ?? []) {
    const celdas = celdasDe(row, months);
    const hijos: FilaPivote[] = (row.children ?? [])
      .filter((c) => c.kind === "account")
      .map((c) => {
        const cc = celdasDe(c, months);
        return {
          key: c.key,
          label: c.label,
          kind: c.kind,
          nivel: 1,
          celdas: cc,
          total: parseAmount(c.total),
          variacionPct: variacionUltimoMes(cc),
          drill: "documentos" as const,
          hijos: [],
        };
      });

    out.push({
      key: row.key,
      label: row.label,
      kind: row.kind,
      nivel: 0,
      celdas,
      total: parseAmount(row.total),
      variacionPct: variacionUltimoMes(celdas),
      drill: hijos.length > 0 ? "hijos" : "ninguno",
      hijos,
    });
  }
  return out;
}

/** El monto del pivote para un concepto y un mes. `null` si la fila o el mes no están.
 *  Es lo que `chequeoLey1` contrasta contra V01. */
export function montoPivote(
  filas: ReadonlyArray<FilaPivote>,
  claves: ReadonlySet<string>,
  periodo: string,
): number | null {
  for (const f of filas) {
    if (!claves.has(f.key)) continue;
    const celda = f.celdas.find((c) => c.periodo === periodo);
    if (celda) return celda.monto;
  }
  return null;
}

export const resultadoPivote = (filas: ReadonlyArray<FilaPivote>, periodo: string) =>
  montoPivote(filas, CLAVES_RESULTADO, periodo);

export const ingresoPivote = (filas: ReadonlyArray<FilaPivote>, periodo: string) =>
  montoPivote(filas, CLAVES_INGRESO, periodo);

/* ────────────────────────── Insight del mes ────────────────────────── */

/** Los ingredientes del insight, ya resueltos, para que la VISTA los formatee (§1.4: el formato
 *  vive en `src/lib/formatters/`, no en el modelo). */
export interface IngredientesInsight {
  resultado: number;
  margenPct: number | null;
  deltaVsAnterior: number | null;
  positivo: boolean;
}

export function ingredientesInsight(
  resultado: number | null,
  ingreso: number | null,
  resultadoAnterior: number | null,
): IngredientesInsight | null {
  if (resultado == null) return null;
  return {
    resultado,
    margenPct: ingreso != null && ingreso !== 0 ? (resultado / ingreso) * 100 : null,
    deltaVsAnterior: resultadoAnterior != null ? resultado - resultadoAnterior : null,
    positivo: resultado > 0,
  };
}

/* ────────────────────────── Footer: excepciones ────────────────────────── */

export interface ExcepcionesFooter {
  /** Documentos que la cascada NO logró clasificar en el rango. `null` = NO SE SABE — el backend
   *  no publicó `origen_counts` en ninguna fila. Nunca 0 por defecto: un cero afirma "no queda
   *  nada fuera", que es justo lo contrario de lo que pasa cuando no llegó el dato. */
  n: number | null;
  /** Qué son esas excepciones, para el apellido de la cifra (§1.4). */
  apellido: string;
}

const APELLIDO_EXCEPCIONES = "documentos que la cascada no logró clasificar en el rango";

/** "No incluye N excepciones" del footer (spec §V08).
 *
 *  El N sale de `origen_counts.unclassified` sumado sobre las CUENTAS del árbol — o sea los
 *  documentos que el motor no supo clasificar. NO es el conteo de la bandeja de V07 (que además
 *  incluye conciliaciones pendientes, otro universo); por eso lleva apellido y no se anuncia como
 *  "excepciones de la bandeja". Si ninguna fila trae `origen_counts`, devuelve `null` y la vista
 *  dice que no lo sabe. */
export function excepcionesFooter(
  bd: OperationalResultBreakdown | null | undefined,
): ExcepcionesFooter {
  if (!bd) return { n: null, apellido: APELLIDO_EXCEPCIONES };
  let n = 0;
  let vistoAlguno = false;

  const visitar = (rows: ReadonlyArray<BreakdownRow>) => {
    for (const r of rows) {
      if (r.origen_counts) {
        vistoAlguno = true;
        n += r.origen_counts["unclassified"] ?? 0;
      }
      if (r.children?.length) visitar(r.children);
    }
  };
  visitar(bd.rows ?? []);

  return { n: vistoAlguno ? n : null, apellido: APELLIDO_EXCEPCIONES };
}

/* ────────────────────────── Costos y gastos (sección del Resultado) ────────────────────────── */

export interface LineaCosto {
  label: string;
  codigo: string;
  /** Magnitud del costo del mes (siempre positiva). */
  monto: number;
  /** % sobre los ingresos del mismo mes; `null` si no hay ingreso base. */
  pctIngresos: number | null;
  /** La cuenta no está clasificada → baja la confianza del dato y se resuelve en la bandeja. */
  sinClasificar: boolean;
}

const RE_SIN_CLASIFICAR = /sin clasificar|unclassified/i;

/** Las cuentas de COSTO del mes elegido, de mayor a menor, con su % de ingresos (HTML 08·C).
 *  Excluye SOLO la sección de ingresos; lo sin clasificar SÍ cuenta ("si se gastó, se gastó") y se
 *  marca para que se vea por qué baja la confianza. */
export function costosDelMes(filas: ReadonlyArray<FilaPivote>, periodo: string): LineaCosto[] {
  const ingreso = ingresoPivote(filas, periodo);
  const base = ingreso != null && ingreso !== 0 ? Math.abs(ingreso) : null;
  const out: LineaCosto[] = [];

  for (const seccion of filas) {
    if (CLAVES_INGRESO.has(seccion.key) || /ingreso/i.test(seccion.label)) continue;
    if (seccion.kind === "subtotal") continue;
    for (const cuenta of seccion.hijos) {
      const celda = cuenta.celdas.find((c) => c.periodo === periodo);
      const v = celda?.monto;
      // Neto negativo del mes ⇒ costo (su magnitud). Neto ≥ 0 (mes sin costo o reverso de NC) ⇒ no.
      if (v == null || v >= 0) continue;
      const monto = -v;
      out.push({
        label: cuenta.label,
        codigo: cuenta.key,
        monto,
        pctIngresos: base != null ? (monto / base) * 100 : null,
        sinClasificar: RE_SIN_CLASIFICAR.test(cuenta.label) || RE_SIN_CLASIFICAR.test(cuenta.key),
      });
    }
  }
  return out.sort((a, b) => b.monto - a.monto);
}

export interface ConfianzaDato {
  nivel: "alta" | "media" | "baja";
  /** Plata sin clasificar del mes. */
  montoSinClasificar: number;
  /** % que representa del costo total del mes; `null` si no hay costo. */
  pctDelCosto: number | null;
}

/** Confianza del dato (HTML 08·C): cuánto del costo del mes está sin clasificar.
 *  Umbrales explícitos — alta < 2 %, media < 10 %, baja de ahí para arriba. */
export const UMBRAL_CONFIANZA_ALTA_PCT = 2;
export const UMBRAL_CONFIANZA_MEDIA_PCT = 10;

export function confianzaDato(lineas: ReadonlyArray<LineaCosto>): ConfianzaDato {
  const total = lineas.reduce((s, l) => s + l.monto, 0);
  const sin = lineas.filter((l) => l.sinClasificar).reduce((s, l) => s + l.monto, 0);
  const pct = total > 0 ? (sin / total) * 100 : null;
  const nivel =
    pct == null || pct < UMBRAL_CONFIANZA_ALTA_PCT
      ? "alta"
      : pct < UMBRAL_CONFIANZA_MEDIA_PCT
        ? "media"
        : "baja";
  return { nivel, montoSinClasificar: sin, pctDelCosto: pct };
}

/* ────────────────────────── Drill-down monto → documentos ────────────────────────── */

export interface DocumentoDrill {
  folio: string | null;
  contraparte: string | null;
  rut: string | null;
  /** Firmado RELATIVO a la cuenta: la factura queda +, la NC −, y la lista suma el total. */
  monto: number;
  origen: string | null;
}

export interface DrillResuelto {
  documentos: DocumentoDrill[];
  /** Total que declara el endpoint. */
  totalDeclarado: number;
  /** Suma de los documentos listados (lo que el usuario puede sumar a mano). */
  totalSumado: number;
  /** Cuántos documentos dice que hay. */
  count: number;
  /** El total declarado y la suma de la lista NO coinciden → se declara (una fila expandida que
   *  suma distinto que su total es exactamente el bug que rompe la confianza del cuadro). */
  descuadra: boolean;
}

export const TOLERANCIA_DRILL_CLP = 1;

export function resolverDrill(
  r: OperationalResultDocuments | null | undefined,
): DrillResuelto | null {
  if (!r) return null;
  const documentos: DocumentoDrill[] = (r.documents ?? []).map((d) => ({
    folio: d.document_ref ?? null,
    contraparte: d.counterparty ?? null,
    rut: d.rut ?? null,
    monto: montoDocEnCuenta(r.total, d.net_amount),
    origen: d.origen ?? null,
  }));
  const totalDeclarado = parseAmount(r.total);
  const totalSumado = documentos.reduce((s, d) => s + d.monto, 0);
  /* El descuadre sólo tiene sentido si la lista está COMPLETA: si el endpoint pagina (count >
     documentos listados), la suma parcial no puede compararse con el total y no se afirma nada. */
  const completa = documentos.length === (r.count ?? documentos.length);
  return {
    documentos,
    totalDeclarado,
    totalSumado,
    count: r.count ?? documentos.length,
    descuadra:
      completa && Math.abs(Math.abs(totalDeclarado) - Math.abs(totalSumado)) > TOLERANCIA_DRILL_CLP,
  };
}

/* ────────────────────────── Comparativo (regla de oro) ────────────────────────── */

/** Los conceptos del comparativo, en el orden del HTML 08·B. Las claves son las del dict
 *  `actual`/`mes_anterior` que publica `/al-dia`. */
export const CONCEPTOS_COMPARATIVO = [
  { key: "revenue", label: "Ingresos" },
  { key: "gross_margin", label: "Margen bruto" },
  { key: "result", label: "Resultado" },
] as const;

export interface FilaComparativo {
  key: string;
  label: string;
  /** Mes en curso, cortado al día N. */
  actual: number | null;
  /** Mes ANTERIOR cortado al MISMO día N — contra esto se compara (regla de oro). */
  anteriorMismaAltura: number | null;
  /** Mes anterior COMPLETO — referencia gris, jamás la base del delta. */
  anteriorCompleto: number | null;
  /** Variación de `actual` contra `anteriorMismaAltura`. `null` si falta base. */
  deltaPct: number | null;
}

export interface ComparativoV08 {
  periodo: string;
  periodoAnterior: string;
  hastaDia: number;
  filas: FilaComparativo[];
  /** El mes anterior completo no llegó → la columna gris se omite en vez de rellenarse. */
  faltaReferencia: boolean;
}

function num(dict: { [k: string]: unknown } | null | undefined, key: string): number | null {
  const v = dict?.[key];
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return parseAmountOrNull(v);
  return null;
}

/** Delta % contra la MISMA ALTURA. Aislado a propósito: es la línea que el mutante (b) cambia. */
export function deltaReglaDeOro(actual: number | null, mismaAltura: number | null): number | null {
  if (actual == null || mismaAltura == null || mismaAltura === 0) return null;
  return ((actual - mismaAltura) / Math.abs(mismaAltura)) * 100;
}

/** El comparativo de la spec: mes en curso al día N vs mes anterior AL MISMO DÍA, con el mes
 *  anterior completo sólo como referencia.
 *
 *  El corte lo hace el BACKEND (`hasta_dia`), no el front: recortar acá una serie mensual daría un
 *  número que no existe en ningún endpoint y que nadie podría reproducir. La columna de referencia
 *  se pide al MISMO endpoint con `hasta_dia = 31` para que las tres columnas tengan la misma
 *  definición (flujo RCV, sin lumps mensuales). */
export function comparativoAlDia(
  alDia: OperationalResultAlDia | null | undefined,
  previoCompleto: OperationalResultAlDia | null | undefined,
): ComparativoV08 | null {
  if (!alDia) return null;
  const periodo = alDia.period;
  const periodoAnterior = shiftPeriod(periodo, -1);
  /* La referencia gris tiene que ser del MES ANTERIOR. Si llegó otra cosa (una respuesta vieja de
     otro período en cache), se descarta: mejor sin columna que con una columna que miente. */
  const refValida = previoCompleto?.period === periodoAnterior ? previoCompleto : null;

  const filas: FilaComparativo[] = CONCEPTOS_COMPARATIVO.map(({ key, label }) => {
    const actual = num(alDia.actual, key);
    const anteriorMismaAltura = num(alDia.mes_anterior, key);
    return {
      key,
      label,
      actual,
      anteriorMismaAltura,
      anteriorCompleto: num(refValida?.actual, key),
      deltaPct: deltaReglaDeOro(actual, anteriorMismaAltura),
    };
  });

  return {
    periodo,
    periodoAnterior,
    hastaDia: alDia.hasta_dia,
    filas,
    faltaReferencia: refValida == null,
  };
}

/** Día del mes en America/Santiago — el `hasta_dia` que se le pide al backend. */
export function diaDelMesSantiago(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    day: "2-digit",
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "day")?.value ?? "1") || 1;
}

/** `hasta_dia` que cubre un mes ENTERO. El contrato acota el parámetro a 1-31. */
export const DIA_MES_COMPLETO = 31;

/* ────────────────────────── Márgenes ────────────────────────── */

export interface KpiMargen {
  label: string;
  monto: number | null;
  pct: number | null;
  detalle: string;
  tono: "default" | "ok";
}

/** Los tres KPI del tab Márgenes (HTML 08·B). Todo del MISMO endpoint del mes: un concepto, una
 *  fuente. El % neto se deriva de result/revenue (el backend publica el bruto ya calculado). */
export function kpisMargen(r: OperationalResultResponse | null | undefined): KpiMargen[] | null {
  if (!r) return null;
  const revenue = parseAmountOrNull(r.revenue);
  const bruto = parseAmountOrNull(r.gross_margin);
  const directo = parseAmountOrNull(r.direct_cost);
  const resultado = parseAmountOrNull(r.result);
  const pctDe = (v: number | null) =>
    v != null && revenue != null && revenue !== 0 ? (v / revenue) * 100 : null;

  return [
    {
      label: "Margen bruto",
      monto: bruto,
      pct: parseAmountOrNull(r.gross_margin_pct) ?? pctDe(bruto),
      detalle: "tras el costo directo",
      tono: bruto != null && bruto > 0 ? "ok" : "default",
    },
    {
      label: "Costo de ventas",
      monto: directo,
      pct: pctDe(directo),
      detalle: "lo que cuesta producir lo que vendes",
      tono: "default",
    },
    {
      label: "Margen neto",
      monto: resultado,
      pct: pctDe(resultado),
      detalle: "lo que queda al final",
      tono: resultado != null && resultado > 0 ? "ok" : "default",
    },
  ];
}

/* ────────────────────────── Tendencia ────────────────────────── */

export interface PuntoTendencia {
  periodo: string;
  ingreso: number | null;
  resultado: number | null;
  /** Margen neto del mes en %; `null` si no hay ingreso base. */
  margenPct: number | null;
  /** El mes en curso (proforma): PARCIAL, no compite por mejor/peor mes. */
  proforma: boolean;
}

export interface TendenciaV08 {
  puntos: PuntoTendencia[];
  mejor: PuntoTendencia | null;
  peor: PuntoTendencia | null;
  /** Promedio simple de los márgenes de los meses CERRADOS; `null` si no hay ninguno. */
  promedioPct: number | null;
}

/** Serie de margen mes a mes desde el breakdown de un rango largo. El mes proforma se marca y se
 *  EXCLUYE de mejor/peor/promedio: medio mes contra meses enteros no es una comparación. */
export function tendencia(bd: OperationalResultBreakdown | null | undefined): TendenciaV08 | null {
  if (!bd) return null;
  const filas = filasPivote(bd);
  const months = bd.months ?? [];
  if (months.length === 0) return null;

  const puntos: PuntoTendencia[] = months.map((periodo) => {
    const ingreso = ingresoPivote(filas, periodo);
    const resultado = resultadoPivote(filas, periodo);
    return {
      periodo,
      ingreso,
      resultado,
      margenPct:
        resultado != null && ingreso != null && ingreso !== 0 ? (resultado / ingreso) * 100 : null,
      proforma: periodo === bd.proforma_month,
    };
  });

  const cerrados = puntos.filter((p) => !p.proforma && p.margenPct != null);
  const mejor = cerrados.reduce<PuntoTendencia | null>(
    (a, p) => (a == null || (p.margenPct ?? 0) > (a.margenPct ?? 0) ? p : a),
    null,
  );
  const peor = cerrados.reduce<PuntoTendencia | null>(
    (a, p) => (a == null || (p.margenPct ?? 0) < (a.margenPct ?? 0) ? p : a),
    null,
  );
  const promedioPct = cerrados.length
    ? cerrados.reduce((s, p) => s + (p.margenPct ?? 0), 0) / cerrados.length
    : null;

  return { puntos, mejor, peor, promedioPct };
}

/* ────────────────────────── Ciclo de caja (bloque de Márgenes) ────────────────────────── */

export interface KpiCiclo {
  label: string;
  dias: number | null;
  detalle: string;
  /** Por qué no se sabe, cuando `dias` es `null`. */
  motivo: string | null;
}

/** Los tres KPI del ciclo (HTML 08·D). El "no sé" es un bucket explícito con su motivo: el DPO del
 *  contrato mide universos distintos en numerador y denominador (sesgo declarado, `qavante-api#133`)
 *  y por eso, cuando no llega, no se rellena con nada. */
export function kpisCiclo(c: CashCycleResponse | null | undefined): KpiCiclo[] | null {
  if (!c) return null;
  return [
    {
      label: "Cobras en (DSO)",
      dias: c.dso_days,
      detalle: "desde que vendes hasta que llega la plata",
      motivo: c.dso_days == null ? "todavía no tenemos ventas y cobranzas suficientes" : null,
    },
    {
      label: "Pagas en (DPO)",
      dias: c.dpo_days,
      detalle: "sobre tu saldo por pagar",
      motivo: c.dpo_days == null ? "necesita tu costo de ventas del período" : null,
    },
    {
      label: "Ciclo completo",
      dias: c.ccc_days,
      detalle: "cuánto tarda tu plata en volver",
      motivo: c.ccc_days == null ? "necesita los dos lados: el de cobro y el de pago" : null,
    },
  ];
}

/* ────────────────────────── 360 · concentración ────────────────────────── */

/** El umbral de la spec §V08: "% concentración con umbral de alerta > 30 %". */
export const UMBRAL_CONCENTRACION_PCT = 30;

/** ¿La concentración de esta contraparte supera el umbral de alerta? `null` (no se sabe) NO es
 *  alerta: sin dato no se afirma dependencia. */
export function alertaConcentracion(pct: number | null): boolean {
  return pct != null && pct > UMBRAL_CONCENTRACION_PCT;
}

export { concentracionPct };

/* ────────────────────────── Exportar (§5.5) ────────────────────────── */

/* El pivote principal no tiene escritor local: su XLSX sale del endpoint que reutiliza el mismo
 * breakdown canónico. Los helpers siguientes sólo cubren tablas secundarias que aún se exportan
 * desde sus modelos presentacionales. */

/** CSV del comparativo. Las tres columnas viajan con su nombre completo, incluido el corte al día:
 *  un archivo que dijera sólo "agosto" y "julio" reintroduciría fuera de la app la ambigüedad que
 *  la regla de oro vino a matar. */
export function csvComparativoTable(c: ComparativoV08): ExportTable {
  const missingOrDecimal = (value: number | null) =>
    value == null ? csvCell.text("sin dato") : csvCell.decimal(value);
  return exportTable(
    [
      "concepto",
      `${c.periodo}_al_dia_${c.hastaDia}`,
      `${c.periodoAnterior}_al_dia_${c.hastaDia}`,
      `${c.periodoAnterior}_completo`,
      "variacion_pct_misma_altura",
    ],
    c.filas.map((f) => [
      csvCell.text(f.label),
      missingOrDecimal(f.actual),
      missingOrDecimal(f.anteriorMismaAltura),
      missingOrDecimal(f.anteriorCompleto),
      missingOrDecimal(f.deltaPct),
    ]),
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csvComparativo(c: ComparativoV08): string {
  const table = csvComparativoTable(c);
  return csv(table.headers, table.rows, table.dialect);
}

/** CSV de los costos del mes. */
export function csvCostosTable(lineas: ReadonlyArray<LineaCosto>, periodo: string): ExportTable {
  return exportTable(
    ["cuenta", "codigo", `monto_${periodo}`, "pct_ingresos", "sin_clasificar"],
    lineas.map((l) => [
      csvCell.text(l.label),
      csvCell.identifier(l.codigo),
      csvCell.decimal(l.monto),
      l.pctIngresos == null ? csvCell.text("sin dato") : csvCell.decimal(l.pctIngresos),
      csvCell.text(l.sinClasificar ? "si" : "no"),
    ]),
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csvCostos(lineas: ReadonlyArray<LineaCosto>, periodo: string): string {
  const table = csvCostosTable(lineas, periodo);
  return csv(table.headers, table.rows, table.dialect);
}

/* ────────────────────────── 360 · perfil de la contraparte ────────────────────────── */

/** Documento del maestro RCV, ya listo para la tabla "Últimos documentos". */
export interface DocContraparte {
  fecha: string;
  folio: string | null;
  /** Etiqueta del tipo ("Factura", "Nota de crédito"). */
  tipo: string;
  /** Firmado: la NC resta. */
  monto: number;
  notaCredito: boolean;
}

export interface Perfil360 {
  rut: string;
  nombre: string;
  /** Neto de los últimos 12 meses (NC ya restadas). */
  volumen12m: number;
  /** % del total de la ventana; `null` si no hay total. */
  concentracionPct: number | null;
  /** Supera el umbral de la spec (> 30 %). */
  alerta: boolean;
  documentos: number;
  /** Mayor documento de la ventana (magnitud); `null` si no hay ninguno. */
  mayorDocumento: number | null;
  /** "YYYY-MM" del último mes con actividad. */
  ultimaActividad: string;
  /** "YYYY-MM" del primer mes con actividad (ventana completa). */
  activoDesde: string;
  /** Mes de calendario (1-12) con el mayor promedio; `null` si no hay estacionalidad medible. */
  mejorMes: number | null;
  ultimos: DocContraparte[];
}

/** Cuántos documentos lista la tabla del 360: los últimos N, ordenados por fecha descendente. */
export const TOPE_DOCS_360 = 12;

/* ────────────────────────── Punto de equilibrio (bloque de Márgenes) ────────────────────────── */

export interface EquilibrioResumen {
  /** Lo que necesitas vender al mes para no perder = lo que gastaste el último mes cerrado. */
  pisoDeVenta: number;
  /** Lo que vendiste ese mismo mes. */
  ingresoMes: number;
  /** ingreso − piso; positivo = holgura, negativo = te faltó. */
  holgura: number;
  /** "YYYY-MM" del mes cerrado que ancla el cálculo. */
  mes: string;
  cubierto: boolean;
}

/** El punto de equilibrio de HTML 08·D, sobre el modelo puro que ya existe (`computePuntoEquilibrio`):
 *  el piso es EMPÍRICO — lo que gastaste el último mes CERRADO —, no una proyección ni un margen
 *  invertido. `null` si el rango no tiene ningún mes cerrado. */
export function equilibrioResumen(
  bd: OperationalResultBreakdown | null | undefined,
): EquilibrioResumen | null {
  if (!bd) return null;
  const pe = computePuntoEquilibrio(bd);
  if (!pe) return null;
  return {
    pisoDeVenta: pe.totalACubrir,
    ingresoMes: pe.ingresoMes,
    holgura: pe.ingresoMes - pe.totalACubrir,
    mes: pe.mes,
    cubierto: pe.ingresoMes >= pe.totalACubrir,
  };
}

/** Perfil 360 de UNA contraparte a partir del maestro RCV. Todo lo que no se puede medir con el
 *  contrato de hoy queda AFUERA y se declara en la vista — en particular "días promedio en pagar",
 *  que exige cruzar cada factura con su pago en el banco (brecha de CC-API): no se aproxima con el
 *  plazo pactado, que es otra cosa. */
export function perfil360(
  docs: ReadonlyArray<DocConVencimiento>,
  rutObjetivo: string,
  desde12: string,
  hasta: string,
  totalGlobal12m: number,
): Perfil360 | null {
  const rut = normalizeRut(rutObjetivo);
  const enVentana = docs.filter((d) => {
    const p = periodoDe(d.fecha);
    return p != null && comparePeriod(p, desde12) >= 0 && normalizeRut(d.rut) === rut;
  });
  if (enVentana.length === 0) return null;

  const agregadoVentana = agregarContrapartes([...enVentana])[0];
  const agregadoTotal = agregarContrapartes(docs.filter((d) => normalizeRut(d.rut) === rut))[0];
  if (!agregadoVentana || !agregadoTotal) return null;

  const pct = concentracionPct(agregadoVentana.total, totalGlobal12m);

  const serie = sinMesEnCurso(serieMensual([...docs], rut, agregadoTotal.primerPeriodo, hasta));
  const est = estacionalidad(serie);
  const mejor = est.reduce<{ mes: number; promedio: number } | null>(
    (a, m) => (m.promedio > 0 && (a == null || m.promedio > a.promedio) ? m : a),
    null,
  );

  const ultimos: DocContraparte[] = enVentana
    .map((d) => ({
      fecha: d.fecha,
      folio: d.folio == null ? null : String(d.folio),
      tipo: isNotaCredito(d.tipoDoc) ? "Nota de crédito" : "Factura",
      monto: montoFirmado(d),
      notaCredito: isNotaCredito(d.tipoDoc),
    }))
    .sort((a, b) => (periodoDe(b.fecha) ?? "").localeCompare(periodoDe(a.fecha) ?? ""))
    .slice(0, TOPE_DOCS_360);

  const mayor = enVentana.reduce((max, d) => Math.max(max, Math.abs(montoFirmado(d))), 0);

  return {
    rut,
    nombre: agregadoVentana.name,
    volumen12m: agregadoVentana.total,
    concentracionPct: pct,
    alerta: alertaConcentracion(pct),
    documentos: agregadoVentana.docs,
    mayorDocumento: mayor > 0 ? mayor : null,
    ultimaActividad: agregadoVentana.ultimoPeriodo,
    activoDesde: agregadoTotal.primerPeriodo,
    mejorMes: mejor?.mes ?? null,
    ultimos,
  };
}

/** CSV de los documentos del 360. */
export function csv360Table(docs: ReadonlyArray<DocContraparte>): ExportTable {
  return exportTable(
    ["fecha", "folio", "tipo", "monto"],
    docs.map((d) => [
      csvCell.date(d.fecha),
      d.folio == null ? csvCell.missing() : csvCell.identifier(d.folio),
      csvCell.text(d.tipo),
      csvCell.decimal(d.monto),
    ]),
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csv360(docs: ReadonlyArray<DocContraparte>): string {
  const table = csv360Table(docs);
  return csv(table.headers, table.rows, table.dialect);
}

export interface Lista360 {
  /** Contrapartes de la ventana de 12 meses, de mayor a menor volumen. */
  agregados: ReturnType<typeof agregarContrapartes>;
  /** Suma de todas: el denominador de la concentración. */
  totalGlobal: number;
  /** Primer mes de la ventana ("YYYY-MM"). */
  desde12: string;
  /** Último mes de la ventana ("YYYY-MM"). */
  hasta: string;
}

/** El buscador del 360: quiénes hay y cuánto pesa cada uno en los últimos 12 meses.
 *  `hasta` es el mes en curso; la ventana son los 12 meses que terminan en él. */
export function lista360(docs: ReadonlyArray<DocConVencimiento>, hasta: string): Lista360 {
  const desde12 = shiftPeriod(hasta, -11);
  const enVentana = docs.filter((d) => {
    const p = periodoDe(d.fecha);
    return p != null && comparePeriod(p, desde12) >= 0 && comparePeriod(p, hasta) <= 0;
  });
  const agregados = agregarContrapartes(enVentana);
  return {
    agregados,
    totalGlobal: agregados.reduce((s, c) => s + c.total, 0),
    desde12,
    hasta,
  };
}

/** Filtra el buscador por nombre o RUT (§5.5: toda tabla se busca). */
export function filtrar360(
  agregados: Lista360["agregados"],
  consulta: string,
): Lista360["agregados"] {
  const q = consulta.trim().toLowerCase();
  if (q === "") return agregados;
  return agregados.filter(
    (c) => c.name.toLowerCase().includes(q) || c.rut.toLowerCase().includes(q),
  );
}
