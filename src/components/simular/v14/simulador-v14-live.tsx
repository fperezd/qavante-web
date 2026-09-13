"use client";

import { useState } from "react";
import { useDashboardSummary } from "@/lib/api/dashboard";
import { toFinancialDecisionReadScope, useFinancialScope } from "@/lib/api/financial-scope";
import { useSimulationEvaluate } from "@/lib/api/simulations";
import { ApiError } from "@/lib/api/errors";
import {
  buildSimulationRequest,
  simulationSuggestions,
  simuladorV14Model,
  toSimulationRequestScope,
  type SimulationRequest,
} from "./simulador-v14-model";
import { SimuladorV14View } from "./simulador-v14-view";

export function SimuladorV14Live() {
  const summary = useDashboardSummary();
  const financialScope = useFinancialScope(summary.data?.generated_at);
  const readScope = toFinancialDecisionReadScope(financialScope.data);
  const scope = toSimulationRequestScope(readScope, summary.data?.generated_at);
  const evaluation = useSimulationEvaluate();
  const [lastRequest, setLastRequest] = useState<SimulationRequest | null>(null);

  const suggestions = scope ? simulationSuggestions(scope.as_of, scope.currency) : [];
  const scopeLoading = summary.isLoading || financialScope.isLoading;
  const scopeError = summary.isError
    ? "No respondió el corte financiero. No usamos la fecha del navegador como reemplazo."
    : financialScope.isError || !scope
      ? "No pudimos resolver una entidad legal y moneda funcional verificables."
      : null;

  function evaluate(question: string, assumption: SimulationRequest["assumptions"][number]) {
    if (!scope) return;
    const request = buildSimulationRequest(scope, question, assumption);
    if (!request) return;
    setLastRequest(request);
    evaluation.mutate(request);
  }

  const error = scopeError ?? (evaluation.error ? errorMessage(evaluation.error) : null);

  return (
    <SimuladorV14View
      model={evaluation.data ? simuladorV14Model(evaluation.data) : null}
      suggestions={suggestions}
      loading={scopeLoading || evaluation.isPending}
      error={error}
      onEvaluate={evaluate}
      onRetry={() => {
        if (scopeError) {
          void summary.refetch();
          void financialScope.refetch();
        } else if (lastRequest) {
          evaluation.mutate(lastRequest);
        }
      }}
    />
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return "Falta contexto verificable para esta fecha. La evaluación se cerró sin inventar un resultado.";
    }
    if (error.status === 422)
      return "El supuesto no es compatible con la información financiera disponible.";
    return "La evaluación no respondió. Vuelve a intentar en un momento.";
  }
  return "La evaluación no respondió. No mostramos un memo parcial como si estuviera completo.";
}
