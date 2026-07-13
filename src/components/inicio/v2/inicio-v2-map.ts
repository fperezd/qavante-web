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
import type { CollectionForecastResponse } from "@/lib/api/treasury";
import type { PagosTimelineProps, PagoCritico, Postergabilidad } from "./pagos-timeline";
import type { ResultadoPreliminarProps } from "./resultado-preliminar";
import { parseAmount } from "../dashboard-format";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

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
  if (s.pulso.top_driver_positive) factores.push({ label: s.pulso.top_driver_positive, tono: "ok" });
  if (s.pulso.top_driver_negative) factores.push({ label: s.pulso.top_driver_negative, tono: "crit" });
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
export function mapCaja(s: DashboardSummaryV2): CajaProyeccionProps | null {
  if (!s.cash_today && !s.cash_forecast) return null;
  const cajaHoy = parseAmount(s.cash_today?.total);
  const filas: CajaFila[] = [];
  const f = s.cash_forecast;
  if (f) {
    const t = (v: string | null | undefined): CajaFila["tono"] => (parseAmount(v) < 0 ? "neg" : "pos");
    filas.push({ label: "Mínima a 14 días", valor: formatClp(parseAmount(f.min_14d)), tono: t(f.min_14d) });
    filas.push({ label: "Mínima a 30 días", valor: formatClp(parseAmount(f.min_30d)), tono: t(f.min_30d) });
    if (f.days_of_cash != null) {
      filas.push({ label: "Días de caja", valor: `~${f.days_of_cash}`, tono: f.days_of_cash <= 0 ? "neg" : "pos" });
    }
  }
  return {
    cajaHoy,
    subtitulo: "Caja hoy · estimada",
    serie: s.cash_sparkline ?? [],
    filas,
    stamp: stampOf(s.cash_today?.last_updated ?? f?.last_updated, f?.source ?? null),
  };
}

/** Brecha total a 14 días (positivo) desde cash_gap. `null` si no hay gap o el
 *  bloque no vino. Alimenta el título del plan; las acciones las compone la vista. */
export function mapBrechaTotal(s: DashboardSummaryV2): number | null {
  const g = s.cash_gap;
  if (!g || !g.has_gap) return null;
  const gap = parseAmount(g.critical_obligations_14d) - parseAmount(g.projected_cash_14d);
  return gap > 0 ? gap : null;
}

/** Cobranza. DEGRADADA sin Fase 2: sin segmentos por comportamiento → muestra el
 *  total por cobrar + estado de vencido. `esperadoATiempo` se setea al total (con
 *  `subtitulo` honesto "Por cobrar", no "esperado a tiempo") y `segmentos:[]`. */
export function mapCobranza(s: DashboardSummaryV2): CobranzaRealizableProps | null {
  const c = s.overdue_collections;
  if (!c) return null;
  const total = parseAmount(c.total_receivable);
  return {
    esperadoATiempo: total,
    subtitulo: "Por cobrar",
    segmentos: [],
    totalPorCobrar: total,
    vencido: parseAmount(c.overdue),
  };
}

const COVERAGE_TAG: Record<string, Postergabilidad> = {
  covered: "cubierto",
  tight: "negociable",
  uncovered: "sin_cobertura",
};

/** Cobranza REALIZABLE desde `collection-forecast` (Fase 2, #572). Lidera con lo
 *  esperado a tiempo (Σ `expected` de los buckets ≤14 días — ya ponderado por la
 *  probabilidad de pago del backend), muestra los buckets hasta 30d como segmentos, y
 *  deja el total nominal + vencido como dato secundario. Reemplaza a `mapCobranza`
 *  (degradada) cuando el endpoint responde. */
export function mapCobranzaForecast(f: CollectionForecastResponse): CobranzaRealizableProps {
  const buckets = f.buckets ?? [];
  const banda = (daysTo: number): BandaCobro =>
    daysTo <= 7 ? "high" : daysTo <= 14 ? "probable" : "unknown";
  const esperadoATiempo = buckets
    .filter((b) => b.days_to <= 14)
    .reduce((s, b) => s + parseAmount(b.expected), 0);
  const segmentos = buckets
    .filter((b) => b.days_to <= 30)
    .map((b) => ({ label: b.label, monto: parseAmount(b.expected), banda: banda(b.days_to) }));
  return {
    esperadoATiempo,
    subtitulo: "Cobranza esperada a tiempo · próximos 14 días",
    segmentos,
    totalPorCobrar: parseAmount(f.total_nominal),
    vencido: parseAmount(f.overdue.nominal),
  };
}

/** Pagos con las 3 fechas clave. Usa `key_obligations` (campo v2: label + due_date
 *  + amount + coverage). `null` si el backend aún no las manda (degrada: la vista
 *  cae al total de critical_payments). El tag sale de la cobertura contra la caja. */
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
  const total = pagos.reduce((sum, p) => sum + p.monto, 0);
  return {
    total,
    totalEnRojo: pagos.some((p) => p.tipo === "sin_cobertura" || p.vencido),
    subtitulo: "Vencimientos clave del mes",
    pagos,
  };
}

/** Resultado. Margen computado (resultado/ingresos). SIN "preliminar"/rango/extra:
 *  esas señales (costos sin clasificar, costo que más creció, concentración) no
 *  están en el summary → se omiten (no se afirma un margen preliminar sin saberlo). */
export function mapResultado(s: DashboardSummaryV2): ResultadoPreliminarProps | null {
  const r = s.operational_result;
  if (!r) return null;
  const resultado = parseAmount(r.result);
  const ingresos = parseAmount(r.revenue);
  const margenPct = ingresos > 0 ? Math.round((resultado / ingresos) * 100) : null;
  return {
    resultado,
    subtitulo: "Resultado operacional del mes",
    ingresos,
    margenLabel: "Margen operacional",
    margen: margenPct != null ? `${margenPct}%` : "—",
    extra: [],
  };
}

/** Frase ejecutiva rule-based (Anexo H.1). "" si no vino. */
export function mapFrase(s: DashboardSummaryV2): string {
  return s.executive_phrase ?? "";
}
