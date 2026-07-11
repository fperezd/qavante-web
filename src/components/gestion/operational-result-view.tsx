"use client";

import * as React from "react";
import { AlertCircle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteEmpty } from "@/components/qavante";
import {
  useOperationalResult,
  useOperationalResultBreakdown,
  type OperationalResultResponse,
} from "@/lib/api/gestion";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatClp } from "@/lib/formatters/clp";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { orderRange, type PeriodRange } from "@/lib/period/period-range";
import { OperationalResultMatrix } from "./operational-result-matrix";
import { parseAmount, formatSignedPct, variationTone } from "./gestion-format";

/* Resultado Operacional de Gestión (Sprint C5, Maestro §7.5). Container:
   resuelve el dato por período + monta la vista. Badge obligatorio "no es
   contabilidad oficial". Estados canónicos (Anexo C): loading / error / sin
   datos (404) / disponible. NO asume faltante = 0 (§13). Gated por el flag
   `operationalResult` (la page lo resuelve). */

export interface OperationalResultViewProps {
  /** Período inicial "YYYY-MM" (lo calcula la page en America/Santiago). */
  initialPeriod: string;
}

const TONE_CLASS: Record<"up" | "down" | "flat", string> = {
  up: "text-success-700",
  down: "text-danger-500",
  flat: "text-neutral-mid",
};

const CONFIDENCE_LABEL: Record<OperationalResultResponse["confidence"], string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
};
const CONFIDENCE_VARIANT: Record<
  OperationalResultResponse["confidence"],
  "success" | "warning" | "danger"
> = { high: "success", medium: "warning", low: "danger" };

export function OperationalResultView({ initialPeriod }: OperationalResultViewProps) {
  /* Selector de rango idéntico al resto de la app (pedido de Fernando: no solo
     un mes). Default = mes actual (rango de un mes). Un mes → vista rica (con
     desglose fino + drivers); varios meses → agregado del período + mes a mes. */
  const [range, setRange] = React.useState<PeriodRange>(() => ({
    desde: initialPeriod,
    hasta: initialPeriod,
  }));
  const ordered = orderRange(range);
  const single = ordered.desde === ordered.hasta;

  // Solo una de las dos queries corre a la vez (la otra queda deshabilitada).
  const monthQuery = useOperationalResult(single ? ordered.hasta : "");
  const breakdownQuery = useOperationalResultBreakdown(ordered.desde, ordered.hasta, {
    enabled: !single,
  });

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <PeriodRangeFilter
        value={range}
        onChange={setRange}
        hint="El resultado se calcula por mes; el rango suma los meses seleccionados."
      />
      <QavanteBadge variant="default">
        Resultado de gestión · no es contabilidad oficial
      </QavanteBadge>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}
      {single ? (
        <StateWrap
          query={monthQuery}
          emptyTitle="Sin datos para este mes"
          emptyDescription="Todavía no hay resultado operacional para el mes seleccionado. Prueba otro mes o vuelve cuando se sincronicen las fuentes."
        >
          {(data) => <Result data={data} />}
        </StateWrap>
      ) : (
        <StateWrap
          query={breakdownQuery}
          emptyTitle="Sin datos para este período"
          emptyDescription="Todavía no hay resultado operacional para el rango seleccionado. Prueba otro rango o vuelve cuando se sincronicen las fuentes."
        >
          {(data) => <OperationalResultMatrix data={data} />}
        </StateWrap>
      )}
    </div>
  );
}

/* Estados canónicos (Anexo C) compartidos por las dos vistas: loading / 404 sin
   datos / error / disponible. NO asume faltante = 0. */
function StateWrap<T>({
  query,
  emptyTitle,
  emptyDescription,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined };
  emptyTitle: string;
  emptyDescription: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isNotFound()) {
      return <QavanteEmpty title={emptyTitle} description={emptyDescription} />;
    }
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>
          {query.error instanceof ApiError
            ? apiErrorToUserMessage(query.error)
            : "No pudimos cargar el resultado operacional. Intenta nuevamente."}
        </p>
      </div>
    );
  }
  return query.data ? <>{children(query.data)}</> : null;
}

function Result({ data }: { data: OperationalResultResponse }) {
  const result = parseAmount(data.result);
  return (
    <div className="space-y-4">
      {/* Headline: resultado del mes + variación. */}
      <QavanteCard variant="bordered">
        <p className="text-sm text-neutral-mid">Resultado operacional del mes</p>
        <p
          className={
            "mt-1 text-3xl font-bold " + (result < 0 ? "text-danger-500" : "text-neutral-dark")
          }
        >
          {formatClp(result)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.variation.vs_previous_month && (
            <VariationChip
              label="vs mes anterior"
              amount={data.variation.vs_previous_month.amount}
              pct={data.variation.vs_previous_month.pct}
            />
          )}
          {data.variation.vs_same_month_last_year && (
            <VariationChip
              label="vs mismo mes año anterior"
              amount={data.variation.vs_same_month_last_year.amount}
              pct={data.variation.vs_same_month_last_year.pct}
            />
          )}
        </div>
      </QavanteCard>

      {/* Desglose (P&L de gestión). */}
      <QavanteCard variant="bordered" header={<span className="font-medium">Desglose</span>}>
        <dl className="divide-y divide-border/60 text-sm">
          <PnlRow label="Ingresos" value={data.revenue} strong />
          <PnlRow label="Costos directos" value={data.direct_cost} negative />
          <PnlRow
            label="Margen bruto"
            value={data.gross_margin}
            strong
            suffix={`${formatSignedPct(data.gross_margin_pct).replace("+", "")} del ingreso`}
          />
          <PnlRow label="Gasto laboral" value={data.labor_cost} negative />
          <PnlRow label="Honorarios" value={data.professional_fees} negative />
          <PnlRow label="Gastos recurrentes" value={data.recurring_expenses} negative />
          <PnlRow label="EBITDA (proxy)" value={data.ebitda_proxy} strong />
        </dl>
      </QavanteCard>

      {/* Drivers — qué explica el resultado (Maestro C6, rule-based). */}
      {data.drivers.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Qué explica el resultado</span>}
        >
          <ul className="space-y-3">
            {data.drivers.map((d, i) => {
              const Icon = d.direction === "improves" ? TrendingUp : TrendingDown;
              const tone = d.direction === "improves" ? "text-success-700" : "text-danger-500";
              return (
                <li key={i} className="flex items-start gap-3">
                  <Icon className={"mt-0.5 h-5 w-5 flex-shrink-0 " + tone} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-dark">
                      {d.concept} <span className={tone}>{formatClp(parseAmount(d.impact))}</span>
                    </p>
                    <p className="text-sm text-neutral-mid">{d.explanation}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </QavanteCard>
      )}

      {/* Confianza + fuentes faltantes + frescura. */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-mid">
        <QavanteBadge variant={CONFIDENCE_VARIANT[data.confidence]}>
          {CONFIDENCE_LABEL[data.confidence]}
        </QavanteBadge>
        {data.missing_sources.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Faltan fuentes: {data.missing_sources.join(", ")} (no se asumen en cero)
          </span>
        )}
      </div>
    </div>
  );
}

function VariationChip({ label, amount, pct }: { label: string; amount: string; pct: string }) {
  const tone = variationTone(amount);
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Info;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs " +
        TONE_CLASS[tone]
      }
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-medium">{formatSignedPct(pct)}</span>
      <span className="text-neutral-mid">{label}</span>
    </span>
  );
}

function PnlRow({
  label,
  value,
  strong,
  negative,
  suffix,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <dt className={"text-neutral-" + (strong ? "dark" : "mid")}>{label}</dt>
      <dd className="flex items-baseline gap-2 text-right">
        {suffix && <span className="text-xs text-neutral-mid">{suffix}</span>}
        <span
          className={
            "tabular-nums " +
            (strong ? "font-semibold text-neutral-dark" : "text-neutral-dark") +
            (negative ? " text-neutral-mid" : "")
          }
        >
          {negative ? "−" : ""}
          {/* Magnitud cuando la fila es "negativa": el "−" de arriba es el
              autoritativo. Evita "−−$300.000" si el backend manda el costo con
              signo (formatClp ya antepone su propio menos a los negativos). */}
          {formatClp(negative ? Math.abs(parseAmount(value)) : parseAmount(value))}
        </span>
      </dd>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="h-64 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
