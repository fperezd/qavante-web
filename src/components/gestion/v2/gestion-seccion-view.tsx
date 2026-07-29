"use client";

import * as React from "react";
import { Info, AlertTriangle } from "lucide-react";
import { QavanteBadge, QavanteInlineError } from "@/components/qavante";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { presetRange, type PeriodRange } from "@/lib/period/period-range";
import {
  useOperationalResult,
  useOperationalResultBreakdown,
  type OperationalResultResponse,
} from "@/lib/api/gestion";
import { parseAmount, formatSignedPct } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";
import { OperationalResultMatrix } from "../operational-result-matrix";
import { TendenciaResultado } from "./tendencia-resultado";
import {
  mapComparativos,
  mapTendencia,
  margenOperacionalPct,
  resultadoConfiable,
  tendenciaConfiable,
} from "./gestion-v2-map";

/* Sub-pantallas FOCALIZADAS de Gestión (pedido de Fernando 2026-07-28): el
   sub-menú separa lo que hoy vive apretado en /gestion en su propia vista.
   REUSA los componentes + mappers + hooks ya testeados (NO toca la vista P&L
   `gestion-v2-view-live`, la más sensible). Conserva la guarda honesta: si el
   resultado no es confiable (margen ≥ 100%), no muestra márgenes/comparativo/
   tendencia con números absurdos. `/gestion` (Resultado del mes) queda como está. */

export type GestionSeccion = "margenes" | "costos" | "tendencia" | "comparativo";

const TITULO: Record<GestionSeccion, string> = {
  margenes: "Márgenes",
  costos: "En qué se va la plata",
  tendencia: "Tendencia",
  comparativo: "Comparativo",
};

/** Rango de 6 meses que termina en `period` (para tendencia). Puro. */
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
  const [range, setRange] = React.useState<PeriodRange>(() =>
    initialPeriod ? { desde: initialPeriod, hasta: initialPeriod } : presetRange("mes_actual"),
  );
  const period = range.hasta;

  // Costos y tendencia necesitan el desglose (breakdown); márgenes/comparativo el mes.
  const needsMes = seccion === "margenes" || seccion === "comparativo";
  const needsBreakdown = seccion === "costos" || seccion === "tendencia";
  const rangoBreakdown =
    seccion === "tendencia"
      ? { from: periodoMenos(period, 5), to: period }
      : { from: period, to: period };

  const mesQuery = useOperationalResult(needsMes ? period : "");
  const breakdownQuery = useOperationalResultBreakdown(rangoBreakdown.from, rangoBreakdown.to, {
    enabled: needsBreakdown,
  });

  const q = needsMes ? mesQuery : breakdownQuery;

  return (
    <div className="space-y-4">
      <PeriodRangeFilter
        value={range}
        onChange={setRange}
        hint={seccion === "tendencia" ? "Muestra los 6 meses hasta el mes elegido." : undefined}
      />

      {q.isError ? (
        <QavanteInlineError
          error={q.error}
          what={`el ${TITULO[seccion].toLowerCase()} de Gestión`}
        />
      ) : q.isFetching && !q.data ? (
        <div
          className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label={`Cargando ${TITULO[seccion].toLowerCase()}`}
        />
      ) : (
        <SeccionBody
          seccion={seccion}
          mes={needsMes ? mesQuery.data : undefined}
          breakdown={needsBreakdown ? breakdownQuery.data : undefined}
        />
      )}
    </div>
  );
}

function SeccionBody({
  seccion,
  mes,
  breakdown,
}: {
  seccion: GestionSeccion;
  mes?: OperationalResultResponse;
  breakdown?: ReturnType<typeof useOperationalResultBreakdown>["data"];
}) {
  // Márgenes / Comparativo derivan del mes → si el resultado no es confiable
  // (margen ≥ 100%, imposible), no mostramos cifras infladas: honesto.
  if ((seccion === "margenes" || seccion === "comparativo") && mes && !resultadoConfiable(mes)) {
    return <NoConfiable />;
  }

  if (seccion === "margenes" && mes) return <Margenes mes={mes} />;
  if (seccion === "comparativo" && mes) return <Comparativo mes={mes} />;
  if (seccion === "tendencia" && breakdown) {
    const puntos = mapTendencia(breakdown);
    if (puntos.length < 2 || !tendenciaConfiable(puntos)) return <NoConfiable />;
    return <TendenciaResultado puntos={puntos} />;
  }
  if (seccion === "costos" && breakdown) return <OperationalResultMatrix data={breakdown} />;
  return <NoConfiable />;
}

function Margenes({ mes }: { mes: OperationalResultResponse }) {
  const bruto = parseAmount(mes.gross_margin);
  const brutoPct = parseAmount(mes.gross_margin_pct);
  const neto = parseAmount(mes.result);
  const netoPct = margenOperacionalPct(mes);
  const row = (k: string, monto: number, pct: number, dashed = true) => (
    <div
      className={`flex items-baseline justify-between gap-3 py-2 ${dashed ? "border-t border-dashed border-border" : ""}`}
    >
      <dt className="text-neutral-mid">{k}</dt>
      <dd className="font-bold tabular-nums text-neutral-dark">
        {formatClp(monto)} · <span className="text-neutral-mid">{fmtPct(pct)}</span>
      </dd>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        Cuánto te queda de cada peso vendido
      </p>
      <dl className="mt-2 flex flex-col text-sm">
        {row("Margen bruto", bruto, brutoPct, false)}
        {row("Margen neto", neto, netoPct)}
      </dl>
      <ConfianzaPie mes={mes} />
    </div>
  );
}

function Comparativo({ mes }: { mes: OperationalResultResponse }) {
  const items = mapComparativos(mes);
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">
        Cómo vengo vs. antes
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-mid">
          Sin períodos anteriores para comparar todavía.
        </p>
      ) : (
        <dl className="mt-2.5 flex flex-col gap-2.5 text-sm">
          {items.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-neutral-mid">{c.label}</dt>
              <dd className={`font-bold ${c.pct >= 0 ? "text-success-700" : "text-danger-500"}`}>
                {formatSignedPct(String(c.pct))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <ConfianzaPie mes={mes} />
    </div>
  );
}

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
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <span className="font-medium text-neutral-dark">Confianza de este dato:</span>
      <QavanteBadge variant={CONF_VARIANT[mes.confidence]}>
        {CONF_LABEL[mes.confidence]}
      </QavanteBadge>
      {(mes.missing_sources ?? []).length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Faltan fuentes: {(mes.missing_sources ?? []).join(", ")} (no se asumen en cero)
        </span>
      )}
    </div>
  );
}

/** Degradación honesta compartida: no mostramos cifras cuando el dato no cierra. */
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
        mostramos como si fuera real. Mirá el detalle en <b>Resultado del mes</b>.
      </p>
    </section>
  );
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
