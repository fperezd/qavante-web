/* Mapper puro: DashboardSummaryV2 → props de los componentes del Inicio v2.
   SIN React → testeable. Cablea SOLO lo que los contratos actuales ya proveen; lo
   que aún no existe (segmentos de cobranza por comportamiento, tendencia 30d del
   Pulso, postergabilidad de pagos, "costo que más creció", conteo sin-clasificar)
   se DEGRADA con honestidad: el mapper omite/deja vacío, nunca inventa. Cada mapper
   devuelve `null` cuando su bloque no vino (el backend puede fallar una fuente sin
   tumbar el resto — Maestro §7.1). */

import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { PulsoCardProps, PulsoFactor } from "./pulso-card";
import type { CajaProyeccionProps, CajaFila } from "./caja-proyeccion";
import type { CobranzaRealizableProps, BandaCobro } from "./cobranza-realizable";
import type { BrechaPlanProps, BrechaAccion } from "./brecha-plan";
import type { CollectionForecastResponse, CashCycleResponse } from "@/lib/api/treasury";
import type { PagosTimelineProps, PagoCritico, Postergabilidad } from "./pagos-timeline";
import type { ResultadoPreliminarProps, ResultadoExtra } from "./resultado-preliminar";
import { parseAmount } from "../dashboard-format";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import {
  importeDesconocido,
  motivoImporteDesconocido,
  rotuloImporteDesconocido,
} from "@/lib/formatters/amount";
import { describeCashGap14d } from "../cash-gap-14d";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatPct } from "@/lib/formatters/pct";

const CONF_WORD: Record<string, string> = { high: "alta", medium: "media", low: "baja" };
function confianzaText(c: string | null | undefined): string {
  return `Confianza de los datos: ${CONF_WORD[c ?? ""] ?? "media"}`;
}

/** Sello de frescura "Actualizado {fecha} · {fuente}" — omite lo ausente. */
export function stampOf(updated?: string | null, source?: string | null): string {
  const parts = ["Actualizado"];
  if (updated) parts.push(formatDateLike(updated));
  const base = parts.length > 1 ? parts.join(" ") : "";
  return source ? (base ? `${base} · ${source}` : `Fuente: ${source}`) : base;
}

/** Pulso (marca). SIN sparkline: la serie de tendencia (q_score, Fase 2) aún no
 *  existe → `tendencia:[]` y `delta:""`; PulsoCard oculta el bloque de tendencia. */
export function mapPulso(s: DashboardSummaryV2): PulsoCardProps | null {
  if (!s.pulso) return null;
  const factores: PulsoFactor[] = [];
  if (s.pulso.top_driver_positive)
    factores.push({ label: s.pulso.top_driver_positive, tono: "ok" });
  if (s.pulso.top_driver_negative)
    factores.push({ label: s.pulso.top_driver_negative, tono: "crit" });
  return {
    score: s.pulso.score,
    status: s.pulso.status,
    confianza: confianzaText(s.pulso.confidence),
    factores,
    tendencia: [],
    delta: "",
  };
}

/** Caja consolidada: hoy + mínimas 14/30 + días. Sparkline solo si el backend
 *  mandó `cash_sparkline` (campo v2); si no, se omite (Sparkline degrada solo). */
/** Subtítulo honesto del saldo según la frescura que declara el backend (§13: un saldo viejo o
 *  estimado no puede verse igual que uno fresco; y sin bloque, no hay saldo). */
function subtituloCaja(cash: DashboardSummaryV2["cash_today"]): string {
  if (!cash) return "Sin dato de saldo · conecta tu banco";
  if (cash.data_state === "stale") return "Caja hoy · desactualizada";
  if (cash.data_state === "estimated") return "Caja hoy · estimada";
  return "Caja hoy";
}

/** Horizonte que el bloque `cash_forecast` acredita por sí solo.
 *
 *  `days_of_cash` sólo se puede leer contra su horizonte: `null` significa "no cruza el mínimo en
 *  el horizonte mirado", y sin el horizonte esa frase no acota nada. El productor de este bloque
 *  proyecta 30 días (`PROJECTION_HORIZON_DAYS`), pero **el bloque NO publica su horizonte**: lo
 *  único que viaja al lado de la cifra es `min_30d`, el mínimo del saldo proyectado sobre los
 *  próximos 30. Así que 30 es exactamente el tramo que esta pantalla puede afirmar con lo que
 *  recibe, y no un número copiado del productor que mentiría en silencio el día que él lo cambie.
 *  Cuando `cash_forecast` publique su `horizon_days` —como ya lo hace `/api/treasury/cash-projection`,
 *  donde el horizonte viaja al lado de la cifra— se lee de ahí y esta constante se va. */
export const HORIZONTE_ACREDITADO_DIAS = 30;

/** Los días de caja como UNA fila honesta.
 *
 *  SEMÁNTICA DEL CONTRATO (qavante-api #564/#1050, `cash_forecast.days_of_cash`): es el PRIMER DÍA
 *  en que la caja proyectada cierra bajo el mínimo configurado. **No** es el cociente del ritmo de
 *  quema, que es lo que medía antes. La diferencia cambia la lectura de cada valor:
 *
 *  - `null` → la curva NO cruza el mínimo en el horizonte. No es "está sana": más allá del tramo
 *    acreditado no hay dato, así que se afirma el tramo y no la salud.
 *  - `0` → la caja ya está bajo el mínimo HOY.
 *  - `n > 0` → cruza el día `n`. **ES UNA ADVERTENCIA**, y cuanto menor el número, más urgente.
 *
 *  LO QUE ESTO ARREGLA: la fila se pintaba `f.days_of_cash <= 0 ? "neg" : "pos"`, una regla escrita
 *  para la definición VIEJA. Bajo la nueva, todo valor no nulo es un cruce, así que esa regla
 *  pintaba en verde exactamente los casos que son advertencia. Con la cartera productiva del
 *  2026-10-04 la pantalla mostraba "Días de caja ~26" en tono positivo sobre un cruce real.
 *  Nada rompía en tipos y nada fallaba en CI: quedaba sólo una pantalla tranquilizadora.
 *
 *  Y LA FILA DECLARA QUÉ DEJA AFUERA. La curva no coloca la deuda ya vencida en ningún día
 *  (poner una fecha de pago que nadie fijó sería inventarla), así que la cifra contesta "hasta
 *  cuándo me alcanza si NO pago lo que ya debo". El monto excluido viaja en el mismo bloque y se
 *  muestra pegado al número: sin él, 26 días se lee como 26 días de holgura. El CONTEO de
 *  documentos de esa deuda NO está en este bloque, así que no se nombra — cruzarlo del bloque de
 *  brecha sería pegarle a este monto el conteo de OTRO monto distinto. */
export function filaDiasDeCaja(f: NonNullable<DashboardSummaryV2["cash_forecast"]>): CajaFila {
  const excluido = parseAmount(f.days_of_cash_vencido_exigible_excluido ?? null);
  const dejaAfuera =
    excluido > 0
      ? ` Deja afuera ${formatClp(excluido)} de deuda ya vencida, que la curva no pone en ningún día.`
      : "";
  const d = f.days_of_cash;
  if (d == null)
    return {
      label: "Días de caja",
      valor: `más de ${HORIZONTE_ACREDITADO_DIAS}`,
      tono: "pos",
      nota: `Tu caja proyectada no baja de tu mínimo en los próximos ${HORIZONTE_ACREDITADO_DIAS} días.${dejaAfuera}`,
    };
  if (d <= 0)
    return {
      label: "Días de caja",
      valor: "0",
      tono: "neg",
      nota: `Tu caja ya está bajo el mínimo que configuraste.${dejaAfuera}`,
    };
  return {
    label: "Días de caja",
    valor: String(d),
    tono: "warn",
    nota: `El día ${d} tu caja proyectada cierra bajo tu mínimo.${dejaAfuera}`,
  };
}

export function mapCaja(s: DashboardSummaryV2): CajaProyeccionProps | null {
  if (!s.cash_today && !s.cash_forecast) return null;
  // Faltante ≠ 0: sin bloque `cash_today` el saldo es DESCONOCIDO (null), no cero.
  const cajaHoy = s.cash_today ? parseAmount(s.cash_today.total) : null;
  const filas: CajaFila[] = [];
  const f = s.cash_forecast;
  if (f) {
    const t = (v: string | null | undefined): CajaFila["tono"] =>
      parseAmount(v) < 0 ? "neg" : "pos";
    filas.push({
      label: "Mínima a 14 días",
      valor: formatClp(parseAmount(f.min_14d)),
      tono: t(f.min_14d),
    });
    filas.push({
      label: "Mínima a 30 días",
      valor: formatClp(parseAmount(f.min_30d)),
      tono: t(f.min_30d),
    });
    filas.push(filaDiasDeCaja(f));
  }
  return {
    cajaHoy,
    subtitulo: subtituloCaja(s.cash_today),
    serie: s.cash_sparkline ?? [],
    filas,
    stamp: stampOf(s.cash_today?.last_updated ?? f?.last_updated, f?.source ?? null),
  };
}

/** Estado de cobertura de la brecha a 14 días. `has_gap` del backend es la FUENTE DE VERDAD (él
 *  sabe del valle intra-período y del colchón de caja mínima; nosotros solo vemos las cifras que
 *  publica). El FE nunca puede degradar un `has_gap: true` a "holgado": si el backend declara
 *  brecha pero no publicó su monto, quedamos en `indeterminado` (ni alarma ni tranquilidad falsa).
 *
 *  El monto es `cash_gap_amount_14d` tal cual (D01/D03, #296): ni "críticas menos caja" ni el
 *  saldo final con el signo cambiado. Ver `describeCashGap14d`. */
export type EstadoBrecha =
  | { tipo: "sin_dato" } // el bloque cash_gap no vino
  | { tipo: "cubierto" } // el backend dice que NO hay brecha
  | { tipo: "brecha"; monto: number } // hay brecha y el backend la cuantificó
  | { tipo: "indeterminado" }; // el backend dice que hay brecha pero no publicó el monto

export function mapEstadoBrecha(s: DashboardSummaryV2): EstadoBrecha {
  const gap = describeCashGap14d(s);
  switch (gap.kind) {
    case "sin_dato":
      return { tipo: "sin_dato" };
    case "cubierto":
      return { tipo: "cubierto" };
    case "brecha":
      return { tipo: "brecha", monto: gap.faltante };
    default:
      return { tipo: "indeterminado" };
  }
}

/** Brecha total a 14 días (positivo) tal como la publica el backend; `null` en el resto de los
 *  casos. Para el termómetro usar `mapEstadoBrecha` (distingue "cubierto" de "hay brecha pero el
 *  backend no la cuantificó"). */
export function mapBrechaTotal(s: DashboardSummaryV2): number | null {
  const e = mapEstadoBrecha(s);
  return e.tipo === "brecha" ? e.monto : null;
}

/** Copy Q1: el monto es la brecha canónica contra cero de la curva (las obligaciones ya están
 * dentro), no una suma ni un saldo. */
export function respuestaEstadoBrecha(e: EstadoBrecha): string {
  if (e.tipo === "brecha") {
    return `La empresa debe asegurar ${formatClp(e.monto)} para que su caja no quede bajo cero en los próximos 14 días.`;
  }
  if (e.tipo === "indeterminado") {
    return "Hay una brecha de caja declarada, pero no podemos cuantificarla con los datos de hoy.";
  }
  return "La caja proyectada cubre las obligaciones críticas de los próximos 14 días.";
}

/** Cobranza. DEGRADADA sin Fase 2: sin segmentos por comportamiento → muestra el
 *  total por cobrar + estado de vencido. `esperadoATiempo` se setea al total (con
 *  `subtitulo` honesto "Por cobrar", no "esperado a tiempo") y `segmentos:[]`. */
export function mapCobranza(s: DashboardSummaryV2): CobranzaRealizableProps | null {
  const c = s.overdue_collections;
  if (!c) return null;
  // #907/#928: `total_receivable: null` + motivo = DESCONOCIDO (cuarentena o sin Empresa
  // activa); nunca $0. El texto lo pone el motivo.
  const enRevision = importeDesconocido(c) || c.total_receivable == null;
  const total = c.total_receivable == null ? null : parseAmount(c.total_receivable);
  return {
    esperadoATiempo: total,
    subtitulo: "Por cobrar",
    segmentos: [],
    totalPorCobrar: total,
    enRevision,
    rotuloDesconocido: rotuloImporteDesconocido(c.amount_unknown_reason),
    motivoDesconocido: motivoImporteDesconocido(c.amount_unknown_reason),
    // `overdue: null` = el SII no entrega vencimientos → "sin dato", NO $0 (que mentiría "al día").
    // Espeja el fix de la vista v1 (#718). parseAmount(null) daría 0 → hay que preservar el null.
    vencido: c.overdue == null ? null : parseAmount(c.overdue),
  };
}

const COVERAGE_TAG: Record<string, Postergabilidad> = {
  covered: "cubierto",
  tight: "negociable",
  uncovered: "sin_cobertura",
};

/** Suma el `expected` (ponderado por probabilidad de pago) de los buckets ≤14 días
 *  del forecast = la cobranza realizable a tiempo. `null` si algún bucket (o el forecast)
 *  está en revisión de conciliación (qavante-api#907): una suma con un sumando desconocido es
 *  desconocida. */
function esperadoATiempo(f: CollectionForecastResponse): number | null {
  const buckets = (f.buckets ?? []).filter((b) => b.days_to <= 14);
  if (importeDesconocido(f) || buckets.some((b) => b.expected == null)) return null;
  return buckets.reduce((s, b) => s + parseAmount(b.expected), 0);
}

/** Plan de cierre de brecha (Fase 2). Compone acciones REALES: (1) cobrar la cobranza
 *  esperada a tiempo (impacto del forecast, estado "probable"); (2) si aún falta,
 *  cubrir el residual con financiamiento ("por evaluar"). La brecha restante corre
 *  acción a acción; el pie separa cobertura identificada de lo pendiente. Sin datos
 *  inventados: el impacto de cobranza sale del forecast y el residual es aritmética. */
export function mapPlanBrecha(
  brechaTotal: number,
  forecast: CollectionForecastResponse,
): BrechaPlanProps | null {
  const esperado = esperadoATiempo(forecast);
  // #907: con la cobranza en revisión no hay impacto que componer; no se asume 0.
  if (esperado == null) return null;
  const cobrar = Math.min(esperado, brechaTotal);
  const residual = Math.max(0, brechaTotal - cobrar);
  const acciones: BrechaAccion[] = [];
  // Solo si la cobranza a tiempo aporta algo: una acción de "+$0 · Probable" es ruido que
  // encabeza el plan con un paso que no mueve la aguja.
  if (cobrar > 0) {
    acciones.push({
      titulo: "Cobrar la cobranza esperada a tiempo",
      impacto: cobrar,
      fecha: "14 días",
      estado: "probable",
      brechaRestante: residual > 0 ? -residual : 0,
    });
  }
  if (residual > 0) {
    acciones.push({
      titulo: "Evaluar cobertura financiera (línea / factoring)",
      impacto: residual,
      fecha: "14 días",
      estado: "por_evaluar",
      brechaRestante: 0,
      restanteNota: "si se aprueba",
    });
  }
  return {
    brechaTotal,
    acciones,
    coberturaIdentificada: cobrar,
    pendienteAsegurar: residual,
  };
}

/** Cobranza REALIZABLE desde `collection-forecast` (Fase 2, #572). Lidera con lo
 *  esperado a tiempo (Σ `expected` de los buckets ≤14 días — ya ponderado por la
 *  probabilidad de pago del backend), muestra los buckets hasta 30d como segmentos, y
 *  deja el total nominal + vencido como dato secundario. Reemplaza a `mapCobranza`
 *  (degradada) cuando el endpoint responde. */
export function mapCobranzaForecast(f: CollectionForecastResponse): CobranzaRealizableProps | null {
  // #907: forecast en revisión de conciliación → montos desconocidos, declarados (no omitidos).
  const esperado = esperadoATiempo(f);
  if (
    importeDesconocido(f) ||
    f.total_nominal == null ||
    esperado == null ||
    f.overdue.nominal == null ||
    f.sin_vencimiento.nominal == null
  ) {
    return {
      esperadoATiempo: null,
      subtitulo: "Cobranza esperada a tiempo · próximos 14 días",
      segmentos: [],
      totalPorCobrar: null,
      vencido: null,
      enRevision: true,
    };
  }
  const totalPorCobrar = parseAmount(f.total_nominal);
  // Sin cuentas por cobrar → omitir (contrato "omite lo ausente"): la vista cae a
  // mapCobranza (que también degrada), no muestra una card de $0.
  if (totalPorCobrar <= 0) return null;
  const banda = (daysTo: number): BandaCobro => (daysTo <= 7 ? "high" : "probable");
  // Segmentos ≤14d para RECONCILIAR con el headline "esperado a tiempo · 14 días":
  // la suma de los segmentos = la cifra grande (0-7 + 8-14). Lo de >14d no entra.
  const segmentos = (f.buckets ?? [])
    .filter((b) => b.days_to <= 14)
    .map((b) => ({
      label: b.label,
      monto: parseAmount(b.expected),
      banda: banda(b.days_to),
    }));
  // Vencido HONESTO (espeja #718/#731): un receivable sin `due_date` sincronizada
  // NO entra en `overdue`, entra en `sin_vencimiento` → si mostramos `overdue=0`
  // como "$0 vencido — al día" con cuentas de vencimiento desconocido, mentimos.
  // Si hay vencido real, lo mostramos; si no, pero hay receivables sin fecha,
  // `null` = "sin dato" (no "al día"); solo $0 real cuando todo tiene fecha.
  const overdueNominal = parseAmount(f.overdue.nominal);
  const sinVencimiento = parseAmount(f.sin_vencimiento.nominal);
  const vencido = overdueNominal > 0 ? overdueNominal : sinVencimiento > 0 ? null : 0;
  return {
    esperadoATiempo: esperado,
    subtitulo: "Cobranza esperada a tiempo · próximos 14 días",
    segmentos,
    totalPorCobrar,
    vencido,
  };
}

/** Pagos con las 3 fechas clave. Usa `key_obligations` (campo v2: label + due_date
 *  + amount + coverage). `null` si el backend aún no las manda. El tag sale de la
 *  cobertura contra la caja.
 *
 *  EL TOTAL Y LAS FILAS CUBREN COSAS DISTINTAS, Y POR ESO SE ROTULAN DISTINTO.
 *  Acá el titular era `pagos.reduce(...)`: la suma de las tres obligaciones clave del mes
 *  (`key_obligations` son `imposiciones`, `impuestos_mensuales` y `sueldos`) puesta bajo el
 *  rótulo "Pagos críticos vencidos y próximos". Son dos preguntas distintas con una sola cifra:
 *  tres obligaciones nombradas del mes no son todo lo crítico que vence, y el servidor publica
 *  lo segundo en `critical_payments.due_14d` ("saldo que vence en ≤14 días, acumulativo, incluido
 *  lo vencido"). Con un proveedor grande venciendo en la ventana, el titular quedaba por debajo
 *  del número que Pagar muestra para la misma pregunta.
 *  Ahora el titular LEE `due_14d` y dice qué cubre; las filas conservan su propio alcance (el
 *  mes) para que no se lean como el desglose del titular. Y `due_14d` nulo por cuarentena de
 *  conciliación (#687) no se rellena con la suma de las filas: se declara con su motivo. */
export function mapPagos(s: DashboardSummaryV2, now: Date): PagosTimelineProps | null {
  const obs = s.key_obligations;
  if (!obs || obs.length === 0) return null;
  // `due_date` es ISO date (YYYY-MM-DD). Comparamos por PARTES de fecha en local
  // (no Date.parse, que da UTC-midnight) → un pago que vence HOY no queda "vencido"
  // en Chile (UTC-3/-4) por el desfase horario.
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const pagos: PagoCritico[] = obs.slice(0, 3).map((o) => {
    const dueYmd = (o.due_date ?? "").slice(0, 10);
    const vencido = dueYmd !== "" && dueYmd < todayYmd;
    return {
      fecha: `${vencido ? "Venció" : "Vence"} ${formatDateLike(o.due_date)}`,
      nombre: o.label,
      monto: parseAmount(o.amount),
      tipo: COVERAGE_TAG[o.coverage] ?? "negociable",
      vencido,
    };
  });
  const cp = s.critical_payments;
  const total = parseAmountOrNull(cp?.due_14d);
  return {
    total,
    /* Sin el agregado no hay cifra: una cuarentena de conciliación deja el monto DESCONOCIDO, y
       un $0 ahí sería la ausencia convertida en buena noticia. */
    totalAusencia:
      total == null
        ? cp?.amount_unknown_reason === "reconciliation_quarantine"
          ? "Hay movimientos en revisión de conciliación, así que el monto a 14 días todavía no se puede sumar."
          : "El servidor no publicó el monto que vence en 14 días."
        : null,
    totalEnRojo: pagos.some((p) => p.tipo === "sin_cobertura" || p.vencido),
    subtitulo: "Vence en los próximos 14 días, incluido lo ya vencido",
    listaLabel: "Obligaciones clave del mes",
    pagos,
  };
}

/** Margen operacional % SOLO si es plausible. Un |resultado| mayor que los ingresos es imposible
 *  (⇒ faltan costos: el mismo bug de datos que destapamos en Gestión, donde el backend manda
 *  labor_cost/direct_cost en $0). Ante eso devolvemos `null` y la vista muestra "Sin información" en vez de un
 *  "margen 1000%". No se inventa ni se clampa: se omite.
 *
 *  Devuelve el porcentaje CRUDO, sin redondear. El redondeo es una decisión de presentación y
 *  vive en `formatPct`: cuando lo hacía este modelo, Inicio decía "9%" sobre el mismo cociente
 *  que Gestión mostraba como "9,3%" — el mismo número con dos valores en dos pantallas, que es
 *  exactamente lo que prohíbe la ley 1 de la especificación. */
export function margenPlausiblePct(resultado: number, ingresos: number): number | null {
  if (ingresos <= 0) return null;
  if (Math.abs(resultado) > ingresos) return null;
  return (resultado / ingresos) * 100;
}

/** Resultado. Margen computado (resultado/ingresos). SIN "preliminar"/rango/extra:
 *  esas señales (costos sin clasificar, costo que más creció, concentración) no
 *  están en el summary → se omiten (no se afirma un margen preliminar sin saberlo). */
export function mapResultado(s: DashboardSummaryV2): ResultadoPreliminarProps | null {
  const r = s.operational_result;
  if (!r) return null;
  const resultado = parseAmount(r.result);
  const ingresos = parseAmount(r.revenue);
  const margenPct = margenPlausiblePct(resultado, ingresos);
  return {
    resultado,
    subtitulo: "Resultado operacional del mes",
    ingresos,
    margenLabel: "Margen operacional",
    margen: margenPct != null ? formatPct(margenPct) : "Sin información",
    extra: [],
  };
}

/** Fila "ciclo de caja" (DSO/DPO) para la card Resultado, desde `cash-cycle`
 *  (Fase 2). `null` si no hay DSO calculable (ventana devengada insuficiente). */
export function cicloCajaExtra(c: CashCycleResponse | undefined): ResultadoExtra | null {
  if (!c || c.dso_days == null) return null;
  const dpo = c.dpo_days != null ? `${c.dpo_days}d` : "Sin información";
  return { label: "Ciclo de caja (cobra / paga)", valor: `${c.dso_days}d / ${dpo}` };
}

/** Frase ejecutiva rule-based (Anexo H.1). "" si no vino. */
export function mapFrase(s: DashboardSummaryV2): string {
  return s.executive_phrase ?? "";
}
