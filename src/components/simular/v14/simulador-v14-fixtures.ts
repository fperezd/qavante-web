import type { SimulationResponse } from "./simulador-v14-model";

export const simulationReadyV14: SimulationResponse = {
  context_contract_version: "v1",
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
      delta: "-2500000",
      currency: "CLP",
      reason_codes: [],
    },
    margin: {
      state: "known",
      before: "8000000",
      after: "5500000",
      delta: "-2500000",
      currency: "CLP",
      reason_codes: [],
    },
    break_even: {
      state: "known",
      before: "20000000",
      after: "22500000",
      delta: "2500000",
      currency: "CLP",
      reason_codes: [],
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
    limitations: [],
    sources: [
      {
        block: "cash",
        state: "current",
        evidence_refs: ["projection:baseline-2026-09-09"],
        reason_codes: [],
      },
      {
        block: "hard_reserves",
        state: "current",
        evidence_refs: ["reserves:baseline-2026-09-09"],
        reason_codes: [],
      },
      {
        block: "policy",
        state: "current",
        evidence_refs: ["cash-policy:v1"],
        reason_codes: [],
      },
      {
        block: "margin",
        state: "current",
        evidence_refs: ["margin:baseline-2026-09-09"],
        reason_codes: [],
      },
      {
        block: "break_even",
        state: "current",
        evidence_refs: ["break-even:baseline-2026-09-09"],
        reason_codes: [],
      },
    ],
  },
  evaluation_hash: "a".repeat(64),
  label: "simulation_no_execution",
  execution: { actions_executed: false, evaluation_persisted: false },
  save: {
    state: "available",
    reference_endpoint: "/api/treasury/simulations/save",
    reason_codes: [],
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
    sources: simulationReadyV14.memo.sources?.map((source) =>
      source.block === "cash"
        ? {
            ...source,
            state: "missing",
            evidence_refs: [],
            reason_codes: ["simulation_context_unavailable"],
          }
        : source,
    ),
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
    cash: {
      state: "unknown",
      before: null,
      after: null,
      delta: null,
      currency: null,
      reason_codes: ["projection_context_stale"],
    },
    sources: simulationReadyV14.memo.sources?.map((source) =>
      source.block === "cash"
        ? { ...source, state: "stale", reason_codes: ["projection_context_stale"] }
        : source,
    ),
    limitations: ["Actualiza la proyección antes de decidir."],
  },
};
