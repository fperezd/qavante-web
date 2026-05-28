"use client";

import * as React from "react";
import { QavanteButton, QavanteInput } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type {
  CashFlowFinancialLayer,
  CashFlowGranularity,
  CashFlowReportParams,
} from "@/lib/api/treasury-reports";

/* Controles de filtros del cash-flow report.
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

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function CashFlowFilters({ value, onChange, loading }: CashFlowFiltersProps) {
  const [draft, setDraft] = React.useState<CashFlowReportParams>(value);

  // Si el value externo cambia (ej. defaults computados en mount), reflejar
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const fromValid = PERIOD_REGEX.test(draft.period_from);
  const toValid = PERIOD_REGEX.test(draft.period_to);
  const rangeValid = fromValid && toValid && draft.period_from <= draft.period_to;
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

  return (
    <form
      onSubmit={handleApply}
      noValidate
      className="space-y-3 rounded-md border border-neutral-light bg-neutral-light/20 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="cf-from" className="text-xs font-medium text-neutral-dark">
            Desde (YYYY-MM)
          </label>
          <QavanteInput
            id="cf-from"
            value={draft.period_from}
            onValueChange={(v) => setDraft({ ...draft, period_from: v })}
            placeholder="2026-05"
            invalid={!fromValid && draft.period_from.length > 0}
            autoComplete="off"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="cf-to" className="text-xs font-medium text-neutral-dark">
            Hasta (YYYY-MM)
          </label>
          <QavanteInput
            id="cf-to"
            value={draft.period_to}
            onValueChange={(v) => setDraft({ ...draft, period_to: v })}
            placeholder="2026-08"
            invalid={!toValid && draft.period_to.length > 0}
            autoComplete="off"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="cf-gran" className="text-xs font-medium text-neutral-dark">
            Granularidad
          </label>
          <select
            id="cf-gran"
            value={draft.granularity ?? "week"}
            onChange={(e) =>
              setDraft({ ...draft, granularity: e.target.value as CashFlowGranularity })
            }
            className={cn(
              "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
            )}
          >
            {GRANULARITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="cf-layer" className="text-xs font-medium text-neutral-dark">
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
            className={cn(
              "flex h-10 w-full rounded-md border border-neutral-light bg-surface px-3 py-2 text-sm text-neutral-dark",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
            )}
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
            : "Período inválido. Formato AAAA-MM, desde ≤ hasta."}
        </p>
        <QavanteButton type="submit" size="sm" loading={loading} disabled={!rangeValid || !dirty}>
          Aplicar
        </QavanteButton>
      </div>
    </form>
  );
}
