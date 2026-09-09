import type { SimulationResponse } from "./simulador-v14-model";

export const simulationReadyV14: SimulationResponse = {
  state: "ready",
  scope: {
    legal_entity_id: "20000000-0000-4000-8000-000000000014",
    currency: "CLP",
    as_of: "2026-09-09T12:00:00Z",
    horizon_days: 90,
  },
  interpretation: "Nuevo gasto de $2,5M dentro del horizonte de 90 días.",
  memo: {
    verdict: "Puedes asumir el gasto, con una condición.",
    cash: {
      state: "known",
      before: "5100000",
      after: "2600000",
      delta: "-1234567",
      currency: "CLP",
      reason_codes: [],
    },
    margin: {
      state: "unknown",
      before: null,
      after: null,
      delta: null,
      currency: null,
      reason_codes: ["margin_producer_unavailable"],
    },
    break_even: {
      state: "unknown",
      before: null,
      after: null,
      delta: null,
      currency: null,
      reason_codes: ["break_even_producer_unavailable"],
    },
    condition: "El cobro confirmado debe entrar antes de la salida.",
    assumptions: [
      {
        kind: "cash_outflow",
        assumption_id: "suggestion.consultor",
        label: "Nuevo gasto",
        amount: "2500000",
        effective_date: "2026-10-09",
        currency: "CLP",
      },
    ],
    evidence_refs: ["projection:baseline-2026-09-09", "user_assumption:suggestion.consultor"],
    freshness: "current",
    limitations: ["El productor canónico de margen todavía no está disponible."],
  },
  evaluation_hash: "a".repeat(64),
  label: "simulation_no_execution",
  execution: { actions_executed: false, evaluation_persisted: false },
  save: {
    state: "unavailable",
    reference_endpoint: "/api/planning/scenarios",
    reason_codes: ["scenario_save_not_idempotent", "scenario_save_api_key_only"],
  },
};

export const simulationPartialV14: SimulationResponse = {
  ...simulationReadyV14,
  state: "partial",
  evaluation_hash: "b".repeat(64),
  memo: {
    ...simulationReadyV14.memo,
    verdict: "Puedo interpretar el supuesto, pero no medir su impacto en caja.",
    cash: {
      state: "unknown",
      before: null,
      after: null,
      delta: null,
      currency: null,
      reason_codes: ["simulation_context_unavailable"],
    },
    freshness: "unknown",
    evidence_refs: ["user_assumption:suggestion.consultor"],
    limitations: ["Falta una proyección base atribuible a este corte."],
  },
};

export const simulationAbstainedV14: SimulationResponse = {
  ...simulationPartialV14,
  state: "abstained",
  evaluation_hash: "c".repeat(64),
  interpretation: "La entidad o el contexto no permiten evaluar esta hipótesis.",
  memo: {
    ...simulationPartialV14.memo,
    verdict: "No puedo evaluar esta decisión con evidencia suficiente.",
    condition: "Conecta o recupera la fuente necesaria y vuelve a intentarlo.",
  },
};

export const simulationStaleV14: SimulationResponse = {
  ...simulationReadyV14,
  state: "partial",
  evaluation_hash: "d".repeat(64),
  memo: {
    ...simulationReadyV14.memo,
    freshness: "stale",
    verdict: "El resultado usa una proyección vencida y no debe decidirse todavía.",
    limitations: ["Actualiza la proyección antes de decidir."],
  },
};
