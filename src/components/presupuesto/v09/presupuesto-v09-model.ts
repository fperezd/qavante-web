import { exportTable, type ExportTable } from "@/lib/export/table";
/* V09 · Presupuesto — modelo PURO (issue qavante-web#74, ESPECIFICACION §V09). Sin React, como
 * `gestion-v08-model.ts` / `remuneraciones-v16-model.ts`: cada cifra de la tríada y de la tabla de
 * desvíos se fija en un test sin montar un DOM.
 *
 * Contesta UNA pregunta: "¿cómo vas contra tu plan, y en qué concepto te desviaste?"
 *
 * ── ALCANCE (issue #101, cierre de los huecos declarados en #74) ───────────────────────────────
 * Esta pantalla entrega la tríada Plan/Real/Desvío + la tabla de desvíos por concepto + el
 * drill-down concepto→cuentas→documentos (decisión BO ratificada 2026-09-20: MISMA interacción
 * que V08 · Gestión, Ley 1) + el banner de proyección de cierre autoritativo del servidor (CC-API
 * #431, "sin extrapolación de interfaz" — este módulo nunca calcula esa cifra).
 *
 * El puente concepto→cuenta lo publica el productor, nunca una heurística del frontend:
 * `BudgetAccountLine.concept` es "la misma partición que las líneas de budget-vs-actual" (#432).
 * `cuentasDeConcepto`/`bucketSinAsignar` filtran por ese campo tal cual llega; `concept_status !==
 * "assigned"` siempre va al bucket "Sin asignar / conflicto", nunca se reparte entre conceptos
 * (el contrato dice que `ambiguous` es "conflicto explícito, no se reparte").
 *
 * `BudgetByAccountResponse.basis` es `"cash_committed"`: el `actual` de estas cuentas es CAJA
 * committed, NO devengado — `budget-vs-actual` (la fila de desvíos) publica el devengado. El total
 * de cuentas `assigned` de un concepto por diseño NO calza con el `real` de esa fila (dos bases
 * contables distintas, no un bug); `crossFootConcepto` declara la diferencia con su propio copy,
 * nunca el "descuadra" rojo que usa V08 para datos incompletos.
 *
 * ── LEY 1 — el "Real" de esta vista es el MISMO número que el "Resultado" de V08 ────────────────
 * RETRACTACIÓN (revisión adversarial, PR #102 vuelta 2): la vuelta 1 fijaba esto comparando la
 * línea `revenue`, y afirmaba que eso "fijaba INV-FIN-001". Es falso — INV-FIN-001
 * (`docs/factory/proposal-pack/08_BUSINESS_INVARIANTS.md`) es, literal:
 *
 *     budget-vs-actual.actual.result == operational-result.result
 *
 * el `result`, no el `revenue` — y `result` es EXACTAMENTE el número que la tríada pinta como
 * "Real" (`triadaV09` lee la línea `result`, no `revenue`). `resultRealCoincideConResultado` fija
 * el invariante CANÓNICO como función pura. `revenueRealCoincideConResultado` sigue existiendo,
 * pero como comprobación ADICIONAL sobre `revenue` — nunca sustituta: un fixture donde `revenue`
 * calza pero `result` diverge (~1,9M) pasaba las 61 aserciones de la vuelta 1 sin que nada lo
 * detectara, porque ninguna comparaba `result`. Ambas están testeadas con fixtures en
 * `presupuesto-v09-model.test.ts`; `resultRealCoincideConResultado` además corre en el camino vivo
 * (`presupuesto-v09-live.tsx` pide `operational-result` del mismo período SÓLO para este guard —
 * `triada.real` sigue leyendo ÚNICAMENTE `budget-vs-actual`, nunca se pinta el número de
 * `operational-result`) y, si el invariante se rompe con datos reales, la vista lo DECLARA en
 * pantalla (Ley 1: dos fuentes que discrepan se muestran las dos, nunca se elige una en
 * silencio) — ver `BannerInvarianteRoto` en `presupuesto-v09-view.tsx`.
 *
 * ── NO SE RECALCULA `variance`/`variance_pct` ────────────────────────────────────────────────
 * El endpoint YA los trae calculados (issue #74): `desvio`/`desvioPct` de este módulo son
 * `parseAmount`/`parseAmountOrNull` puros sobre `BudgetLine.variance`/`variance_pct` — nunca
 * `real - plan` recalculado en el front (eso duplicaría la fuente del concepto, Ley 1).
 * RETRACTACIÓN (qavante-web#103): esta cabecera afirmaba que `plan-real-model.ts` (Inicio v2 /
 * Presupuesto Fase 1a) SÍ recalculaba "fuera de alcance" de este issue — dejó de ser cierto:
 * #103 encontró exactamente esa divergencia (backend 21,1 % vs widget 21 %, sólo por el redondeo
 * a entero DEL CÁLCULO, no de la presentación) y la corrigió. `mapPlanReal` (camino MENSUAL, el
 * único con un `BudgetLine` por línea) lee `variance`/`variance_pct` tal cual, igual que este
 * módulo; sólo `agregarPlanReal` (acumulado ANUAL) sigue derivando, porque el backend no expone
 * `budget-vs-actual` de rango — no es la misma excepción que existía acá.
 *
 * ── "NO SÉ" EXPLÍCITO (Ley 3) ─────────────────────────────────────────────────────────────────
 * `estadoDatosV09` declara `sin_presupuesto` (has_budget=false) e `incompleto` (data_state≠
 * "available" o `missing_sources` no vacío) como buckets propios — la vista nunca pinta un plan
 * o un desvío inventado sobre ninguno de los dos. */

import type {
  BudgetAccountLine,
  BudgetByAccountResponse,
  BudgetClosingProjectionResponse,
  BudgetLine,
  BudgetVsActualResponse,
  ClosingProjectionPeriod,
  ClosingProjectionSource,
} from "@/lib/api/planning";
import { parseAmount, parseAmountOrNull } from "@/lib/formatters/amount";
import { csv, csvCell } from "@/lib/export/csv";
import { currentPeriodSantiago, shiftPeriod } from "../../gestion/gestion-format";

/* ── Período por defecto: el último mes CERRADO ───────────────────────────────────────────────
 * Mismo criterio que `periodoDefaultV16` (remuneraciones) y que el modo "Mes" de la pantalla
 * Presupuesto actual (ADR-0091 Fase 1a): el mes en curso normalmente no tiene el período contable
 * cerrado todavía. */
export function periodoDefaultV09(hoy: Date): string {
  return shiftPeriod(currentPeriodSantiago(hoy), -1);
}

/* ── Conceptos de la tabla de desvíos (P&L, sin `result` — ese es el total de la tríada) ────── */
const CONCEPTO_LABEL: Record<Exclude<BudgetLine["concept"], "result">, string> = {
  revenue: "Ingresos",
  direct_cost: "Costo directo",
  operating_expense: "Gastos operacionales",
};

/* ── (0) Estado del dato: el bucket "no sé" explícito ─────────────────────────────────────────
 * `sin_presupuesto`: no hay plan cargado del período — no se pinta ningún plan/desvío.
 * `incompleto`: hay plan, pero el motor declara el dato parcial/estimado o faltan fuentes — se
 *   muestra igual (es lo mejor que hay), pero la pantalla lo DICE, no lo esconde.
 * `completo`: dato disponible y sin fuentes faltantes. */
export type EstadoDatosV09 = "sin_presupuesto" | "incompleto" | "completo";

export function estadoDatosV09(
  bva: Pick<BudgetVsActualResponse, "has_budget" | "data_state" | "missing_sources">,
): EstadoDatosV09 {
  if (!bva.has_budget) return "sin_presupuesto";
  if (bva.data_state !== "available" || (bva.missing_sources?.length ?? 0) > 0) return "incompleto";
  return "completo";
}

/* ── (1) Tríada: Plan / Real / Desvío (línea `result`) ───────────────────────────────────────── */

export interface TriadaV09 {
  periodoLabel: string;
  /** Presupuestado del resultado (con signo). */
  plan: number;
  /** Realizado del resultado (con signo) — Ley 1: SIEMPRE viene de `budget-vs-actual`, nunca se
   *  reemplaza por `operational-result.result` aunque el guard `resultRealCoincideConResultado`
   *  detecte que difieren (en ese caso la vista declara AMBOS números, no elige uno en silencio —
   *  ver `BannerInvarianteRoto` en `presupuesto-v09-view.tsx`). */
  real: number;
  /** `BudgetLine.variance` de la línea `result`, sin recalcular. */
  desvio: number;
  /** `BudgetLine.variance_pct` de la línea `result`, sin recalcular. `null` sólo si el campo no
   *  vino / no es numérico (nunca por decisión del front). */
  desvioPct: number | null;
  /** `true` si el desvío es favorable (mismo signado uniforme que `plan-real-model.ts`: con
   *  `result` ya sumado con signo, `desvio >= 0` es SIEMPRE "vas mejor que el plan"). */
  favorable: boolean;
}

/** `null` si no vino la línea `result` (contrato roto) o si no hay presupuesto (`has_budget`
 *  falso) — en ese caso el contenedor debe usar `estadoDatosV09`, no esta función, para decidir
 *  qué mostrar. */
export function triadaV09(periodoLabel: string, bva: BudgetVsActualResponse): TriadaV09 | null {
  if (!bva.has_budget) return null;
  const linea = (bva.lines ?? []).find((l) => l.concept === "result");
  if (!linea) return null;

  const desvio = parseAmount(linea.variance);
  return {
    periodoLabel,
    plan: parseAmount(linea.budget),
    real: parseAmount(linea.actual),
    desvio,
    desvioPct: parseAmountOrNull(linea.variance_pct),
    favorable: desvio >= 0,
  };
}

/* ── (2) Tabla de desvíos: una fila por concepto de P&L, sin `result` ────────────────────────── */

export interface DesvioLineaV09 {
  concepto: Exclude<BudgetLine["concept"], "result">;
  label: string;
  plan: number;
  real: number;
  desvio: number;
  desvioPct: number | null;
  favorable: boolean;
}

/** Desvíos por concepto (Ingresos / Costo directo / Gastos operacionales), peor primero (mismo
 *  orden que la tabla de "Lo que se desvía" de la pantalla actual). Las líneas sin desvío
 *  (`desvio === 0`) se omiten — no aportan nada a "qué se desvía". `plan/real/desvio` de cada fila
 *  son lecturas directas de `BudgetLine`, nunca recalculadas (ver cabecera del módulo). */
export function desviosV09(bva: BudgetVsActualResponse): DesvioLineaV09[] {
  if (!bva.has_budget) return [];
  return (bva.lines ?? [])
    .filter(
      (l): l is BudgetLine & { concept: Exclude<BudgetLine["concept"], "result"> } =>
        l.concept !== "result",
    )
    .map((l) => {
      const desvio = parseAmount(l.variance);
      return {
        concepto: l.concept,
        label: CONCEPTO_LABEL[l.concept],
        plan: parseAmount(l.budget),
        real: parseAmount(l.actual),
        desvio,
        desvioPct: parseAmountOrNull(l.variance_pct),
        favorable: desvio >= 0,
      };
    })
    .filter((d) => d.desvio !== 0)
    .sort((a, b) =>
      a.favorable !== b.favorable
        ? a.favorable
          ? 1
          : -1
        : Math.abs(b.desvio) - Math.abs(a.desvio),
    );
}

/* ── INV-FIN-001 — el invariante CANÓNICO, `result` contra `result` ──────────────────────────
 * `docs/factory/proposal-pack/08_BUSINESS_INVARIANTS.md`, literal:
 *
 *     budget-vs-actual.actual.result == operational-result.result
 *
 * "si ambos declaran representar el mismo resultado operacional." `result` es el número que la
 * tríada PINTA como "Real" (`triadaV09` lee la línea `result`) — por eso es éste, y no `revenue`,
 * el que hay que guardar. Si algún día el Real de esta pantalla deja de calzar con el Resultado de
 * V08 (o el backend deja de cumplir el contrato), esta guarda se vuelve `false`: el test que la
 * ejercita (`presupuesto-v09-model.test.ts`) cae, y en el camino vivo la vista declara la
 * divergencia en pantalla (`presupuesto-v09-live.tsx` / `BannerInvarianteRoto`). */
export function resultRealCoincideConResultado(
  bva: Pick<BudgetVsActualResponse, "lines">,
  resultOperationalResult: string | null | undefined,
): boolean {
  const linea = (bva.lines ?? []).find((l) => l.concept === "result");
  if (!linea) return false;
  return parseAmount(linea.actual) === parseAmount(resultOperationalResult);
}

/* ── Comprobación ADICIONAL sobre `revenue` (no sustituta de INV-FIN-001) ─────────────────────
 * Verificado contra producción (issue #74, comentario 2026-08-31): el `actual` de la línea
 * `revenue` de `budget-vs-actual` es EXACTAMENTE `operational-result.revenue` del mismo período.
 * Complementa a `resultRealCoincideConResultado`: `revenue` puede calzar mientras `result` diverge
 * (costos/gastos entre medio con otra discrepancia) — este chequeo por sí solo NO habría detectado
 * ese caso (hallazgo de revisión adversarial, PR #102 vuelta 2). */
export function revenueRealCoincideConResultado(
  bva: Pick<BudgetVsActualResponse, "lines">,
  revenueOperationalResult: string | null | undefined,
): boolean {
  const linea = (bva.lines ?? []).find((l) => l.concept === "revenue");
  if (!linea) return false;
  return parseAmount(linea.actual) === parseAmount(revenueOperationalResult);
}

export { concordar } from "@/lib/formatters/count";

/* ── Exportar (§5.5): CSV de la tabla de desvíos ──────────────────────────────────────────────
 * Exacto sobre lo que está en pantalla: las mismas filas, los mismos montos y el mismo `variance`/
 * `variance_pct` sin recalcular (mismo patrón que `csvCostos`/`csvPivote` de `gestion-v08-model.ts`). */
export function csvDesviosV09Table(filas: ReadonlyArray<DesvioLineaV09>): ExportTable {
  return exportTable(
    ["concepto", "plan", "real", "desvio", "desvio_pct"],
    filas.map((f) => [
      csvCell.text(f.label),
      csvCell.decimal(f.plan),
      csvCell.decimal(f.real),
      csvCell.decimal(f.desvio),
      f.desvioPct == null ? csvCell.text("sin dato") : csvCell.decimal(f.desvioPct),
    ]),
  );
}

/** CSV interoperable: no contiene tipos de celda para Excel. */
export function csvDesviosV09(filas: ReadonlyArray<DesvioLineaV09>): string {
  const table = csvDesviosV09Table(filas);
  return csv(table.headers, table.rows, table.dialect);
}

/* ═══════════════════════════ Drill-down nivel 1: concepto → cuentas (issue #101) ═══════════════
 * `budget-by-account` trae TODAS las cuentas del período en una sola consulta (`presupuesto-v09-
 * live.tsx` la pide una vez, siempre habilitada — alimenta tanto el drill-down por concepto como
 * el bucket fijo de "Sin asignar"). Estas funciones sólo FILTRAN la respuesta ya recibida; nunca
 * recalculan `actual`/`budget`/`variance` (mismo principio que `desviosV09`). */

/** Cuentas `assigned` a un concepto, orden por `|actual|` descendente (la más grande primero —
 *  mismo criterio de lectura que la tabla de desvíos). Nunca incluye `ambiguous`/`unassigned`:
 *  esas van SIEMPRE al bucket separado (`bucketSinAsignar`), nunca repartidas por heurística. */
export function cuentasDeConcepto(
  porCuenta: Pick<BudgetByAccountResponse, "accounts"> | undefined,
  concepto: Exclude<BudgetLine["concept"], "result">,
): BudgetAccountLine[] {
  return (porCuenta?.accounts ?? [])
    .filter((c) => c.concept_status === "assigned" && c.concept === concepto)
    .slice()
    .sort((a, b) => Math.abs(parseAmount(b.actual)) - Math.abs(parseAmount(a.actual)));
}

/** Bucket "Sin asignar / conflicto": toda cuenta con `concept_status !== "assigned"` —
 *  `ambiguous` (sus impactos caen en más de un concepto: "conflicto explícito, no se reparte",
 *  contrato de `BudgetAccountLine`) o `unassigned` (ningún impacto pertenece al P&L operacional).
 *  Vive FUERA de cualquier concepto, con su propio total — nunca se suma silenciosamente a una
 *  fila de la tabla de desvíos ni se omite. */
export interface BucketSinAsignarV09 {
  cuentas: BudgetAccountLine[];
  totalActual: number;
  totalBudget: number;
}

export function bucketSinAsignar(
  porCuenta: Pick<BudgetByAccountResponse, "accounts"> | undefined,
): BucketSinAsignarV09 {
  const cuentas = (porCuenta?.accounts ?? [])
    .filter((c) => c.concept_status !== "assigned")
    .slice()
    .sort((a, b) => Math.abs(parseAmount(b.actual)) - Math.abs(parseAmount(a.actual)));
  return {
    cuentas,
    totalActual: cuentas.reduce((s, c) => s + parseAmount(c.actual), 0),
    totalBudget: cuentas.reduce((s, c) => s + parseAmount(c.budget), 0),
  };
}

/** Cross-foot del nivel 1 contra la fila de desvíos del mismo concepto: declara la diferencia,
 *  nunca la esconde ni la trata como un bug. `basisDistinto` es SIEMPRE `true` cuando hay cuentas
 *  `assigned` que sumar — es un hecho del contrato (`basis: "cash_committed"` vs el devengado de
 *  `budget-vs-actual`), no una detección de anomalía; por eso no hay un umbral de tolerancia como
 *  `TOLERANCIA_DRILL_CLP` en V08: ahí el descuadre SÍ es señal de datos incompletos, acá es
 *  estructural y esperado. */
export interface CrossFootConceptoV09 {
  totalCuentasCommitted: number;
  totalFilaDevengado: number;
  diferencia: number;
  /** `false` sólo cuando no hay ninguna cuenta `assigned` que sumar (nada que cross-footear). */
  basisDistinto: boolean;
}

export function crossFootConcepto(
  cuentas: ReadonlyArray<BudgetAccountLine>,
  filaDesvio: Pick<DesvioLineaV09, "real">,
): CrossFootConceptoV09 {
  const totalCuentasCommitted = cuentas.reduce((s, c) => s + parseAmount(c.actual), 0);
  return {
    totalCuentasCommitted,
    totalFilaDevengado: filaDesvio.real,
    diferencia: totalCuentasCommitted - filaDesvio.real,
    basisDistinto: cuentas.length > 0,
  };
}

/* ═══════════════════════════ Proyección de cierre (CC-API #431, issue #101) ═════════════════════
 * Autoritativa del servidor: "cierre anual autoritativo, sin extrapolación de interfaz". Este
 * módulo SOLO traduce la respuesta a algo legible — jamás suma, resta ni proyecta un monto. Si
 * `projected_result` es `null`, `disponible` es `false` y la vista muestra `abstentionReasons`
 * (Ley 3: "no sé" explícito), nunca un 0 ni el banner "completo". */

const METODO_PROYECCION_LABEL: Record<BudgetClosingProjectionResponse["method"], string> = {
  closed_actual_plus_remaining_budget:
    "resultado real de los meses ya cerrados + presupuesto de los meses restantes",
};

const COBERTURA_LABEL: Record<BudgetClosingProjectionResponse["coverage"], string> = {
  complete: "completa",
  partial: "parcial",
  unknown: "desconocida",
};

export interface ProyeccionCierreV09 {
  disponible: boolean;
  monto: number | null;
  moneda: string;
  metodoLabel: string;
  coberturaLabel: string;
  dataState: BudgetClosingProjectionResponse["data_state"];
  asOf: string;
  fiscalYear: number;
  abstentionReasons: string[];
  periods: ClosingProjectionPeriod[];
  sources: ClosingProjectionSource[];
}

export function resolverProyeccionCierre(
  resp: BudgetClosingProjectionResponse | undefined,
): ProyeccionCierreV09 | null {
  if (!resp) return null;
  const monto = resp.projected_result != null ? parseAmount(resp.projected_result) : null;
  return {
    disponible: monto != null,
    monto,
    moneda: resp.currency,
    metodoLabel: METODO_PROYECCION_LABEL[resp.method] ?? resp.method,
    coberturaLabel: COBERTURA_LABEL[resp.coverage] ?? resp.coverage,
    dataState: resp.data_state,
    asOf: resp.as_of,
    fiscalYear: resp.fiscal_year,
    abstentionReasons: resp.abstention_reasons ?? [],
    periods: resp.periods ?? [],
    sources: resp.sources ?? [],
  };
}
