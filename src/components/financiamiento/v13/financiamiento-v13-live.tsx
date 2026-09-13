"use client";

import { DataState } from "@/components/rediseno/data-state";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  toFinancingEvaluation,
  useFinancingOverview,
  useWorkingCapitalRefinancingEvaluation,
} from "@/lib/api/financing";
import { toFinancialDecisionReadScope, useFinancialScope } from "@/lib/api/financial-scope";
import { financingV13Model } from "./financiamiento-v13-model";
import { FinanciamientoV13View } from "./financiamiento-v13-view";

export function FinanciamientoV13Live() {
  const summary = useDashboardSummary();
  const financialScope = useFinancialScope(summary.data?.generated_at);
  const scope = toFinancialDecisionReadScope(financialScope.data);
  const overview = useFinancingOverview(scope);
  const evaluation = useWorkingCapitalRefinancingEvaluation(scope);

  if (
    summary.isLoading ||
    financialScope.isLoading ||
    (scope && (overview.isLoading || evaluation.isLoading))
  ) {
    return (
      <div
        role="status"
        className="rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie px-6 py-10 text-center"
      >
        <p className="font-medium text-rediseno-tinta">Consultando deuda, costo y capacidad…</p>
        <p className="mt-1 text-[13px] text-rediseno-tinta-3">
          La fuente todavía no publica un tiempo estimado para esta lectura.
        </p>
      </div>
    );
  }

  if (summary.isError) {
    return (
      <DataState
        status="error"
        what="el corte de tu empresa"
        cause="No pudimos confirmar la fecha de la información financiera para esta consulta."
        action={{ label: "Reintentar", onClick: () => void summary.refetch() }}
      />
    );
  }

  if (financialScope.isError || !scope) {
    return (
      <DataState
        status="error"
        what="la entidad y moneda de esta lectura"
        cause="No pudimos confirmar la empresa y moneda para consultar el financiamiento."
        action={{ label: "Reintentar", onClick: () => void financialScope.refetch() }}
      />
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <DataState
        status="error"
        what="tu financiamiento"
        cause="La lectura de deuda no respondió. No mostramos saldos ni capacidad hasta recuperar su respaldo."
        action={{ label: "Reintentar", onClick: () => void overview.refetch() }}
      />
    );
  }

  if (evaluation.isError || !evaluation.data) {
    return (
      <DataState
        status="error"
        what="alternativas verificables de financiamiento"
        cause="La deuda verificable respondió, pero la evaluación no. No presentamos alternativas ni convertimos esa ausencia en una recomendación."
        action={{ label: "Reintentar", onClick: () => void evaluation.refetch() }}
      />
    );
  }

  return (
    <FinanciamientoV13View
      model={financingV13Model(overview.data, toFinancingEvaluation(evaluation.data))}
    />
  );
}
