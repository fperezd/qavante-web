"use client";

import * as React from "react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type {
  CashFlowFinancialLayer,
  CashFlowGranularity,
  CashFlowReportParams,
} from "@/lib/api/treasury-reports";
import {
  buildMonthOptions,
  cashFlowQuickRanges,
  isValidPeriodRange,
  matchCashFlowQuickRange,
} from "./cash-flow-format";

/* Controles de filtros del cash-flow report.
   - Atajos de período (este mes / 3 meses / 6 meses / este año), que fijan rango y
     granularidad de una y consultan al tiro
   - Periodo from/to (YYYY-MM)
   - Granularity (month / week / day)
   - Financial layer (committed / budget / forecast / scenario / ...)

   Scope MVP: dejo fuera group_by, account_id, currency, scenario_id,
   version_id, include_attention. Cuando los necesitemos en wave 2, se
   agregan acá (props ya tipados en CashFlowReportParams). */

const GRANULARITIES: Array<{ value: CashFlowGranularity; label: string }> = [
  { value: "month", label: "Mes" },
  { value: "week", label: "Semana" },
  { value: "day", label: "Día" },
];

const LAYERS: Array<{ value: CashFlowFinancialLayer; label: string }> = [
  { value: "committed", label: "Comprometido (real)" },
  { value: "budget", label: "Presupuesto" },
  { value: "forecast", label: "Forecast" },
  { value: "scenario", label: "Escenario" },
  { value: "manual_simulation", label: "Simulación manual" },
  { value: "ai_projection", label: "Proyección IA" },
];

export interface CashFlowFiltersProps {
  value: CashFlowReportParams;
  onChange: (next: CashFlowReportParams) => void;
  /** Disabled durante la query en vuelo. */
  loading?: boolean;
}

/* Estilo compartido de los <select> del panel (rango + granularidad + capa). */
const SELECT_CLASS = cn(
  "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-neutral-dark",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
);

export function CashFlowFilters({ value, onChange, loading }: CashFlowFiltersProps) {
  const [draft, setDraft] = React.useState<CashFlowReportParams>(value);

  // Si el value externo cambia (ej. defaults computados en mount), reflejar
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  /* Opciones de mes (MM-AAAA visible, YYYY-MM como value) para los selects de
     rango. Se calculan una vez al montar. */
  const monthOptions = React.useMemo(() => buildMonthOptions(), []);
  /* Los atajos y el que está activo se resuelven contra el mismo "ahora" que las opciones
     de mes: se calculan una vez al montar para que el botón marcado no baile. */
  const quickRanges = React.useMemo(() => cashFlowQuickRanges(), []);
  const activeQuickRange = matchCashFlowQuickRange(value);

  const rangeValid = isValidPeriodRange(draft.period_from, draft.period_to);
  const dirty =
    draft.period_from !== value.period_from ||
    draft.period_to !== value.period_to ||
    draft.granularity !== value.granularity ||
    draft.financial_layer !== value.financial_layer;

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!rangeValid) return;
    onChange(draft);
  }

  /* Un atajo no es un borrador: fija rango + granularidad y consulta en el mismo clic.
     Pedir después "Aplicar" convertiría un atajo en dos pasos. La capa queda como está:
     el atajo habla de cuándo, no de qué capa. */
  function handleQuickRange(range: ReturnType<typeof cashFlowQuickRanges>[number]) {
    const next: CashFlowReportParams = {
      ...draft,
      period_from: range.period_from,
      period_to: range.period_to,
      granularity: range.granularity,
    };
    setDraft(next);
    onChange(next);
  }

  return (
    <form
      onSubmit={handleApply}
      noValidate
      className="space-y-3 rounded-xl border border-border bg-surface-muted p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          id="cf-quick-label"
          className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
        >
          Período
        </span>
        <div role="group" aria-labelledby="cf-quick-label" className="flex flex-wrap gap-2">
          {quickRanges.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => handleQuickRange(range)}
              aria-pressed={activeQuickRange === range.key}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                activeQuickRange === range.key
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-border bg-surface text-neutral-dark hover:bg-surface-muted",
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label
            htmlFor="cf-from"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
            Desde
          </label>
          <select
            id="cf-from"
            value={draft.period_from}
            onChange={(e) => setDraft({ ...draft, period_from: e.target.value })}
            className={SELECT_CLASS}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="cf-to"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
            Hasta
          </label>
          <select
            id="cf-to"
            value={draft.period_to}
            onChange={(e) => setDraft({ ...draft, period_to: e.target.value })}
            className={SELECT_CLASS}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="cf-gran"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
            Granularidad
          </label>
          <select
            id="cf-gran"
            value={draft.granularity ?? "week"}
            onChange={(e) =>
              setDraft({ ...draft, granularity: e.target.value as CashFlowGranularity })
            }
            className={SELECT_CLASS}
          >
            {GRANULARITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="cf-layer"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
          >
            Capa
          </label>
          <select
            id="cf-layer"
            value={draft.financial_layer ?? "committed"}
            onChange={(e) =>
              setDraft({
                ...draft,
                financial_layer: e.target.value as CashFlowFinancialLayer,
              })
            }
            className={SELECT_CLASS}
          >
            {LAYERS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-mid">
          {rangeValid
            ? "Aplica para consultar el reporte."
            : "El mes inicial no puede ser posterior al final."}
        </p>
        <QavanteButton type="submit" size="sm" loading={loading} disabled={!rangeValid || !dirty}>
          Aplicar
        </QavanteButton>
      </div>
    </form>
  );
}
