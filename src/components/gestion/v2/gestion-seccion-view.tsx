"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CalendarClock,
  Minus,
} from "lucide-react";
import { QavanteBadge, QavanteInlineError, QavanteStatTile } from "@/components/qavante";
import { Sparkline } from "@/components/ui/sparkline";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { type PeriodRange } from "@/lib/period/period-range";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import {
  useOperationalResult,
  useOperationalResultBreakdown,
  type OperationalResultResponse,
  type OperationalResultBreakdown,
} from "@/lib/api/gestion";
import { parseAmount } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { OperationalResultMatrix } from "../operational-result-matrix";
import { TendenciaResultado, type TendenciaPunto } from "./tendencia-resultado";
import {
  evaluarTendenciaMargen,
  mapTendencia,
  separarMesEnCurso,
  margenOperacionalPct,
  mesCorto,
  resultadoConfiable,
  tendenciaConfiable,
} from "./gestion-v2-map";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import { DraggableCard } from "../../inicio/v2/draggable-card";
import {
  applyWidgetOrder,
  moveItem,
  readWidgetOrder,
  withWidgetOrder,
} from "../../inicio/v2/widget-order";

/** Clave propia del orden de las tarjetas de Márgenes (no choca con la de Inicio). */
const MARGENES_ORDER_KEY = "margenes_widget_order";

/* Sub-pantallas FOCALIZADAS y RICAS de Gestión (pedido de Fernando 2026-07-28):
   el sub-menú separa lo que vivía apretado en /gestion; cada una con cards KPI +
   un visual + drill-down, sin tocar la vista P&L `gestion-v2-view-live`. Reusa
   QavanteStatTile, Sparkline, OperationalResultMatrix, TendenciaResultado y los
   mappers testeados. Conserva la guarda de honestidad (margen ≥100% ⇒ no mostrar
   cifras infladas). react-query dedupe → sin fetch de más. */

export type GestionSeccion = "margenes" | "costos" | "tendencia" | "comparativo";

const TITULO: Record<GestionSeccion, string> = {
  margenes: "Márgenes",
  costos: "Costos y gastos",
  tendencia: "Tendencia",
  comparativo: "Comparativo",
};

/** Resta `n` meses a "YYYY-MM" (aritmética pura). */
function periodoMenos(period: string, n: number): string {
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (!m) return period;
  let y = Number(m[1]);
  let mes = Number(m[2]) - n;
  while (mes <= 0) {
    mes += 12;
    y -= 1;
  }
  return `${y}-${String(mes).padStart(2, "0")}`;
}

export function GestionSeccionView({
  seccion,
  initialPeriod,
}: {
  seccion: GestionSeccion;
  initialPeriod: string;
}) {
  const isTendencia = seccion === "tendencia";
  // La reportabilidad NO abre en el MES EN CURSO (incompleto → márgenes/tendencia falsos con ventas a
  // medias): abre en el último mes CERRADO. El en curso sigue seleccionable y se reformula.
  const ultimoCerrado = periodoMenos(initialPeriod, 1);
  // Tendencia = RANGO (varios meses); el resto = UN mes (el selector debe reflejarlo,
  // pedido de Fernando: antes un picker de rango sobre una vista de un mes confundía).
  const [period, setPeriod] = React.useState(ultimoCerrado);
  const [range, setRange] = React.useState<PeriodRange>(() => ({
    desde: periodoMenos(ultimoCerrado, 5),
    hasta: ultimoCerrado,
  }));
  const months = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => periodoMenos(initialPeriod, i)),
    [initialPeriod],
  );
  // ¿El usuario navegó al mes EN CURSO? (Márgenes/Costos: se reformula, no se muestra a medias.)
  const enCurso = period === initialPeriod;

  const needsMes = seccion === "margenes" || seccion === "costos" || seccion === "comparativo";
  // Ventana del breakdown: tendencia = el rango elegido; márgenes = 6 meses (sparkline);
  // costos = solo el mes.
  const bdFrom = isTendencia
    ? range.desde
    : seccion === "margenes"
      ? periodoMenos(period, 5)
      : period;
  const bdTo = isTendencia ? range.hasta : period;

  const mesQuery = useOperationalResult(needsMes ? period : "");
  const prevQuery = useOperationalResult(seccion === "comparativo" ? periodoMenos(period, 1) : "");
  const yoyQuery = useOperationalResult(seccion === "comparativo" ? periodoMenos(period, 12) : "");
  const bdQuery = useOperationalResultBreakdown(bdFrom, bdTo, {
    enabled: seccion === "costos" || isTendencia || seccion === "margenes",
  });

  // La query "principal" para loading/error de la sección.
  const q = isTendencia ? bdQuery : mesQuery;

  return (
    <div className="space-y-4">
      {isTendencia ? (
        <PeriodRangeFilter
          value={range}
          onChange={setRange}
          hint="Cada barra es un mes. Cambiá el rango para ver más o menos meses."
        />
      ) : (
        <MonthPicker value={period} onChange={setPeriod} months={months} />
      )}

      {q.isError ? (
        <QavanteInlineError error={q.error} what={`${TITULO[seccion]} de Gestión`} />
      ) : q.isFetching && !q.data ? (
        <div
          className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label={`Cargando ${TITULO[seccion]}`}
        />
      ) : (
        <SeccionBody
          seccion={seccion}
          mes={mesQuery.data}
          prev={prevQuery.data}
          yoy={yoyQuery.data}
          breakdown={bdQuery.data}
          enCurso={enCurso}
          period={period}
        />
      )}
    </div>
  );
}

function SeccionBody({
  seccion,
  mes,
  prev,
  yoy,
  breakdown,
  enCurso,
  period,
}: {
  seccion: GestionSeccion;
  mes?: OperationalResultResponse;
  prev?: OperationalResultResponse;
  yoy?: OperationalResultResponse;
  breakdown?: OperationalResultBreakdown;
  enCurso?: boolean;
  period?: string;
}) {
  // Mes EN CURSO (Márgenes/Costos): las ventas del mes recién empiezan → los márgenes/costos no se
  // leen a medias. No mostramos números como si el mes estuviera cerrado.
  if (enCurso && (seccion === "margenes" || seccion === "costos")) {
    return <SeccionEnCurso seccion={seccion} period={period ?? ""} />;
  }
  // Guarda honesta para las que derivan del mes.
  if (seccion !== "tendencia" && mes && !resultadoConfiable(mes)) return <NoConfiable />;

  if (seccion === "margenes" && mes) return <Margenes mes={mes} breakdown={breakdown} />;
  if (seccion === "costos" && mes) return <CostosGastos mes={mes} breakdown={breakdown} />;
  if (seccion === "comparativo" && mes) return <Comparativo mes={mes} prev={prev} yoy={yoy} />;
  if (seccion === "tendencia" && breakdown) {
    // La tendencia es sobre meses CERRADOS: un mes en curso (ej. día 3) tiene costos casi completos
    // contra pocas ventas → un margen absurdo (−1443%) que NO es "el peor mes", solo que aún no cierra.
    // Se excluye del mejor/peor/promedio y del gráfico; se muestra aparte como nota (pedido de Fernando).
    const { cerrados, enCurso } = separarMesEnCurso(mapTendencia(breakdown));
    if (cerrados.length < 2) return <SinDato label="tendencia" />;
    // Guarda de honestidad: algún mes con margen >100% (bug de costos en $0) ⇒ no mostrar la
    // tendencia como real (mismo criterio que la vista P&L). Antes esta sub-vista lo omitía.
    if (!tendenciaConfiable(cerrados)) return <TendenciaNoConfiable />;
    return <Tendencia puntos={cerrados} enCurso={enCurso} />;
  }
  return <SinDato label={TITULO[seccion].toLowerCase()} />;
}

/* ---------- Márgenes ---------- */
function Margenes({
  mes,
  breakdown,
}: {
  mes: OperationalResultResponse;
  breakdown?: OperationalResultBreakdown;
}) {
  const rev = parseAmount(mes.revenue);
  const bruto = parseAmount(mes.gross_margin);
  const brutoPct = parseAmount(mes.gross_margin_pct);
  const costoVentas = Math.max(0, rev - bruto);
  const costoPct = rev > 0 ? (costoVentas / rev) * 100 : 0;
  const neto = parseAmount(mes.result);
  const netoPct = margenOperacionalPct(mes);
  // Histórico del margen sobre meses CERRADOS (el mes en curso, parcial, distorsiona el sparkline).
  const puntos = breakdown ? separarMesEnCurso(mapTendencia(breakdown)).cerrados : [];
  const serie = puntos.map((p) => p.margenPct);

  // Tarjetas reordenables (pedido de Fernando): "De cada $100" y el histórico del margen van
  // lado a lado y se pueden mover. El orden se persiste por usuario×empresa en /api/me/preferences
  // (mismo patrón que Inicio v2, con clave propia para no pisarse).
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const [localOrder, setLocalOrder] = React.useState<string[] | null>(null);

  const widgets: { id: string; label: string; node: React.ReactNode }[] = [];
  // "De cada $100": los 3 tramos derivan de los MISMOS montos ($) → suman 100 y ninguno negativo.
  // Solo si el mes es plausible (resultado ≥0 y ≤ margen bruto).
  if (rev > 0 && neto >= 0 && bruto >= neto) {
    widgets.push({
      id: "de-cada-100",
      label: "De cada $100",
      node: (
        <DeCada100
          costoPct={costoPct}
          gastosPct={((bruto - neto) / rev) * 100}
          quedaPct={(neto / rev) * 100}
        />
      ),
    });
  }
  if (serie.length >= 2) {
    widgets.push({
      id: "margen-historico",
      label: `Margen bruto últimos ${serie.length} meses`,
      node: (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
            Margen bruto · últimos {serie.length} meses
          </p>
          <div className="mt-3 overflow-x-auto">
            <Sparkline data={serie} tone="brand" width={520} height={56} markers />
          </div>
        </div>
      ),
    });
  }

  const savedOrder = readWidgetOrder(prefs.data?.preferences, MARGENES_ORDER_KEY);
  const ordered = applyWidgetOrder(widgets, localOrder ?? savedOrder);
  const reorderable = ordered.length >= 2;
  const reorder = (from: number, to: number) => {
    const currentIds = ordered.map((w) => w.id);
    const nextIds = moveItem(currentIds, from, to);
    if (nextIds === currentIds) return; // no-op / fuera de rango
    setLocalOrder(nextIds);
    // Solo persiste sobre un GET exitoso: el PUT REEMPLAZA el blob completo (no merge).
    if (prefs.isSuccess)
      updatePrefs.mutate(withWidgetOrder(prefs.data?.preferences, nextIds, MARGENES_ORDER_KEY));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Margen bruto"
          value={`${formatClp(bruto)} · ${fmtPct(brutoPct)}`}
          tone="success"
          info="Ingresos menos el costo de lo vendido. Cuánto te queda antes de los gastos."
        />
        <QavanteStatTile
          label="Costo de ventas"
          value={`${formatClp(costoVentas)} · ${fmtPct(costoPct)}`}
          tone="muted"
          info="Lo que te costó producir/entregar lo que vendiste, como % de tus ventas."
        />
        <QavanteStatTile
          label="Margen neto"
          value={`${formatClp(neto)} · ${fmtPct(netoPct)}`}
          tone={neto >= 0 ? "success" : "danger"}
          info="Lo que queda después de TODOS los costos y gastos operacionales."
        />
      </div>

      <AlertaTendenciaMargen puntos={puntos} />

      {/* "De cada $100" y el histórico del margen, lado a lado y reordenables (arrastrar o ↑/↓). */}
      {ordered.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {ordered.map((w, i) =>
            reorderable ? (
              <DraggableCard
                key={w.id}
                label={w.label}
                index={i}
                count={ordered.length}
                onMove={reorder}
              >
                {w.node}
              </DraggableCard>
            ) : (
              <React.Fragment key={w.id}>{w.node}</React.Fragment>
            ),
          )}
        </div>
      )}
      <ConfianzaPie mes={mes} />
    </div>
  );
}

/* Alerta de tendencia del margen: el sparkline muestra la línea, pero no dice si es buena/mala ni
   cuánto se movió. Compara el margen del primer mes de la ventana vs el último y, si el cambio es
   material (≥ 3 puntos porcentuales), pone un veredicto en palabras. Estable ⇒ sin ruido. */
function AlertaTendenciaMargen({ puntos }: { puntos: TendenciaPunto[] }) {
  const v = evaluarTendenciaMargen(puntos);
  if (!v) return null;
  const { baja, desde, hasta, meses: n } = v;
  const Icon = baja ? ArrowDownRight : ArrowUpRight;
  return (
    <section
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
        baja
          ? "border-warning-500/40 bg-warning-500/[.06]"
          : "border-success-700/30 bg-success-700/[.06]"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${baja ? "text-warning-700" : "text-success-700"}`}
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold text-neutral-dark">
          Tu margen viene {baja ? "bajando" : "mejorando"}: de {fmtPct(desde)} a {fmtPct(hasta)} en{" "}
          {n} {n === 1 ? "mes" : "meses"}.
        </p>
        {baja && (
          <p className="mt-0.5 text-neutral-mid">
            Revisa <b>Costos y gastos</b> para ver qué se movió más rápido que las ventas.
          </p>
        )}
      </div>
    </section>
  );
}

/* "De cada $100 que vendes, ¿dónde queda?" — traduce los tres márgenes a una barra intuitiva de
   dueño (costo de ventas + gastos + lo que queda = $100). Solo en meses con resultado ≥ 0, para no
   pintar una barra con segmento negativo. Los % ya vienen calculados (suman ~100). */
function DeCada100({
  costoPct,
  gastosPct,
  quedaPct,
}: {
  costoPct: number;
  gastosPct: number;
  quedaPct: number;
}) {
  const seg = (label: string, pct: number, dotClass: string) => (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-neutral-mid">
        <span className={`inline-block h-2.5 w-2.5 rounded-sm ${dotClass}`} aria-hidden="true" />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-neutral-dark">
        {formatClp(Math.round(pct))}
      </span>
    </div>
  );
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold text-neutral-dark">
        De cada $100 que vendes, ¿dónde queda?
      </h2>
      <div
        className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-neutral-light/30"
        role="img"
        aria-label={`De cada $100: ${Math.round(costoPct)} costo de ventas, ${Math.round(
          gastosPct,
        )} gastos, ${Math.round(quedaPct)} te queda`}
      >
        <span className="h-full bg-neutral-mid/50" style={{ width: `${costoPct}%` }} />
        <span className="h-full bg-warning-500/70" style={{ width: `${gastosPct}%` }} />
        <span className="h-full bg-success-700/80" style={{ width: `${quedaPct}%` }} />
      </div>
      <div className="mt-3 space-y-1.5">
        {seg("Costo de ventas", costoPct, "bg-neutral-mid/50")}
        {seg("Gastos (laboral, honorarios, recurrentes)", gastosPct, "bg-warning-500/70")}
        {seg("Te queda", quedaPct, "bg-success-700/80")}
      </div>
    </section>
  );
}

/* ---------- Costos y gastos ---------- */
function CostosGastos({
  mes,
  breakdown,
}: {
  mes: OperationalResultResponse;
  breakdown?: OperationalResultBreakdown;
}) {
  const rev = parseAmount(mes.revenue);
  const directo =
    parseAmount(mes.direct_cost) + parseAmount(mes.labor_cost) + parseAmount(mes.professional_fees);
  const operacional = parseAmount(mes.recurring_expenses);
  const pct = (v: number) => (rev > 0 ? (Math.abs(v) / rev) * 100 : 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QavanteStatTile
          label="Costo directo"
          value={`${formatClp(directo)} · ${fmtPct(pct(directo))}`}
          tone="muted"
          info="Lo que cuesta entregar el servicio/producto: mano de obra directa, honorarios y costos directos."
        />
        <QavanteStatTile
          label="Gasto operacional"
          value={`${formatClp(operacional)} · ${fmtPct(pct(operacional))}`}
          tone="muted"
          info="Los gastos de operar la empresa (administración, arriendo, servicios, etc.)."
        />
      </div>
      {breakdown ? (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 px-2 text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
            Detalle cuenta por cuenta
          </p>
          <OperationalResultMatrix data={breakdown} />
        </div>
      ) : (
        <SinDato label="detalle" />
      )}
      <ConfianzaPie mes={mes} />
    </div>
  );
}

/* ---------- Tendencia ---------- */
function TendenciaNoConfiable() {
  return (
    <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5 text-[13px]">
      <p className="font-bold text-warning-700">No podemos mostrar la tendencia con confianza</p>
      <p className="mt-1 text-neutral-dark">
        Algún mes da un margen imposible (≥100%), típicamente un gasto revertido o mal clasificado.
        Está escalado; mira el detalle en <b>Resultado</b>.
      </p>
    </section>
  );
}

function Tendencia({
  puntos,
  enCurso,
}: {
  puntos: TendenciaPunto[];
  enCurso?: TendenciaPunto | null;
}) {
  const vals = puntos.map((p) => p.margenPct);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const prom = vals.reduce((s, v) => s + v, 0) / vals.length;
  const mejor = puntos.find((p) => p.margenPct === max);
  const peor = puntos.find((p) => p.margenPct === min);
  // "oct 2025" (con año, para no confundir dos octubres de años distintos).
  const mesAno = (p?: TendenciaPunto | null) => {
    if (!p) return "—";
    const y = p.periodoFull?.match(/^(\d{4})-/);
    return `${mesCorto(p.periodoFull ?? p.periodo)}${y ? ` ${y[1]}` : ""}`;
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Mejor mes"
          value={`${mesAno(mejor)} · ${fmtPct(max)}`}
          tone="success"
        />
        <QavanteStatTile
          label="Peor mes"
          value={`${mesAno(peor)} · ${fmtPct(min)}`}
          tone={min < 0 ? "danger" : "muted"}
        />
        <QavanteStatTile label="Promedio del período" value={fmtPct(prom)} tone="default" />
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <TendenciaResultado puntos={puntos} />
      </div>
      {enCurso && (
        <p className="px-0.5 text-[11.5px] text-neutral-mid">
          <b className="text-neutral-dark">{mesAno(enCurso)}</b> va en curso — todavía no entra en
          la tendencia (se compara recién cuando cierre el mes; su margen parcial no es comparable
          con meses completos).
        </p>
      )}
    </div>
  );
}

/* ---------- Comparativo ---------- */
function Comparativo({
  mes,
  prev,
  yoy,
}: {
  mes: OperationalResultResponse;
  prev?: OperationalResultResponse;
  yoy?: OperationalResultResponse;
}) {
  const metricas: { label: string; get: (r: OperationalResultResponse) => number }[] = [
    { label: "Ingresos", get: (r) => parseAmount(r.revenue) },
    { label: "Margen bruto", get: (r) => parseAmount(r.gross_margin) },
    { label: "Resultado", get: (r) => parseAmount(r.result) },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metricas.map((m) => {
          const actual = m.get(mes);
          return (
            <QavanteStatTile
              key={m.label}
              label={m.label}
              value={formatClp(actual)}
              tone={actual >= 0 ? "default" : "danger"}
              hint={
                <span className="flex flex-col gap-0.5">
                  <Delta
                    label="vs mes anterior"
                    actual={actual}
                    base={prev ? m.get(prev) : undefined}
                  />
                  <Delta
                    label="vs año anterior"
                    actual={actual}
                    base={yoy ? m.get(yoy) : undefined}
                  />
                </span>
              }
            />
          );
        })}
      </div>
      <ConfianzaPie mes={mes} />
    </div>
  );
}

function Delta({ label, actual, base }: { label: string; actual: number; base?: number }) {
  if (base === undefined)
    return <span className="text-[11px] text-neutral-light">{label}: sin dato</span>;
  const diff = base === 0 ? null : ((actual - base) / Math.abs(base)) * 100;
  const up = (diff ?? 0) >= 0;
  const Icon = diff === null ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = diff === null ? "text-neutral-mid" : up ? "text-success-700" : "text-danger-500";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${color}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}: {diff === null ? "—" : `${up ? "+" : ""}${diff.toFixed(1)}%`}
    </span>
  );
}

/* ---------- Compartidos ---------- */
const CONF_LABEL: Record<OperationalResultResponse["confidence"], string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
};
const CONF_VARIANT: Record<
  OperationalResultResponse["confidence"],
  "success" | "warning" | "danger"
> = { high: "success", medium: "warning", low: "danger" };

function ConfianzaPie({ mes }: { mes: OperationalResultResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <span className="font-medium text-neutral-dark">Confianza de este dato:</span>
      <QavanteBadge variant={CONF_VARIANT[mes.confidence]}>
        {CONF_LABEL[mes.confidence]}
      </QavanteBadge>
      {(mes.missing_sources ?? []).length > 0 && (
        <span>Faltan fuentes: {(mes.missing_sources ?? []).join(", ")} (no se asumen en cero)</span>
      )}
    </div>
  );
}

function NoConfiable() {
  return (
    <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5">
      <p className="inline-flex items-center gap-2 text-[13px] font-bold text-warning-700">
        <AlertTriangle className="size-[18px] shrink-0" aria-hidden="true" />
        No podemos mostrar este dato con confianza
      </p>
      <p className="mt-2 text-[13px] text-neutral-dark">
        El resultado del mes da un margen imposible (100% o más) —típicamente un gasto revertido o
        mal clasificado infla el número—. Es un problema de datos del backend, ya escalado; no lo
        mostramos como si fuera real. Mirá el detalle en <b>Resultado</b>.
      </p>
    </section>
  );
}

function SinDato({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-sm text-neutral-mid">
      Sin datos suficientes para mostrar {label} en este período. Probá con otro mes.
    </p>
  );
}

/** Mes EN CURSO en Márgenes/Costos: no se muestran a medias (ventas del mes recién empiezan). */
function SeccionEnCurso({ seccion, period }: { seccion: GestionSeccion; period: string }) {
  const que = seccion === "margenes" ? "los márgenes" : "los costos y gastos";
  return (
    <section className="rounded-xl border border-brand-primary/25 bg-brand-primary/[.05] p-6">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-base font-bold text-neutral-dark">
            {formatPeriodLabel(period)} va en curso — aún sin cerrar
          </h2>
          <p className="text-sm text-neutral-mid">
            {que.charAt(0).toUpperCase() + que.slice(1)} de un mes a medias no se pueden leer: los
            costos ya están, pero las ventas del mes recién empiezan.
          </p>
          <p className="text-[13px] text-neutral-mid">
            Elegí el mes anterior en el selector de arriba (la pantalla arranca ahí por defecto).
          </p>
        </div>
      </div>
    </section>
  );
}

/** Selector de UN mes (para Márgenes/Costos/Comparativo: son vistas de un mes,
    no de rango). Dropdown nativo con los últimos meses, etiqueta "julio 2026". */
function MonthPicker({
  value,
  onChange,
  months,
}: {
  value: string;
  onChange: (m: string) => void;
  months: string[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
      <Calendar className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
      <span className="sr-only">Mes</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-neutral-dark focus-visible:outline-none"
        aria-label="Elegir mes"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {formatPeriodLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
