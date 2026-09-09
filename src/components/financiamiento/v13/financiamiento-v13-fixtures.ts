import type {
  FinancingEvaluationContract,
  FinancingOverviewContract,
} from "./financiamiento-v13-model";

export const overviewParcialV13: FinancingOverviewContract = {
  scope: {
    tenant_id: "10000000-0000-4000-8000-000000000013",
    legal_entity_id: "20000000-0000-4000-8000-000000000013",
    currency: "CLP",
    as_of: "2026-09-09T12:00:00Z",
  },
  state: "partial",
  reason_codes: ["comparable_cost_evidence_required", "verified_credit_capacity_required"],
  outstanding_principal: "8503076",
  remaining_financial_cost: "503076",
  comparable_cost_rate: null,
  verified_available_capacity: null,
  debt_coverage: "partial",
  debts: [
    {
      debt_ref: "debt-synthetic-1",
      instrument_type: "loan",
      counterparty: "Banco de ejemplo",
      outstanding_principal: "8503076",
      contract_rate_type: "fixed_monthly",
      contract_rate_value: "0.014",
      remaining_financial_cost: "503076",
      next_payment_date: "2026-09-20",
      next_payment_amount: "650000",
      maturity_date: "2027-09-20",
      source_refs: ["decision:synthetic-1"],
    },
  ],
  freshness: {
    status: "fresh",
    observed_at: "2026-09-09T11:00:00Z",
    valid_through: "2026-09-11T11:00:00Z",
  },
  source_refs: ["decision:synthetic-1"],
  snapshot_hash: "a".repeat(64),
};

export const evaluationV13: FinancingEvaluationContract = {
  state: "ready",
  scope: overviewParcialV13.scope,
  source_refs: ["decision:synthetic-1", "offer:synthetic-1"],
  snapshot_hash: "b".repeat(64),
  verified_working_capital_offer_count: 1,
  refinancing_context: {
    state: "ready",
    debt_count: 1,
    verified_offer_count: 1,
  },
  working_capital: {
    state: "observed_only",
    need_kind: "point_in_time",
    reasons: ["verified_offer_required"],
    alternatives: [
      {
        code: "working-capital:no-action",
        instrument_type: "working_capital",
        state: "comparable",
        eligibility_state: "eligible",
        is_no_action: true,
        dimensions: { total_financial_cost: "0", net_liquidity: "0", duration_days: 0 },
      },
      {
        code: "working-capital:reference",
        instrument_type: "working_capital",
        state: "indicative",
        eligibility_state: "potentially_eligible",
        is_no_action: false,
        reason_codes: ["verified_offer_required"],
        dimensions: {
          total_financial_cost: "80000",
          maximum_debt_service: "1100000",
          net_liquidity: "2000000",
          duration_days: 60,
          payment_concentration: "1100000",
        },
      },
    ],
  },
  refinancing: {
    state: "ready",
    verified_offer_count: 1,
    alternatives: [
      {
        code: "refinancing:reference",
        instrument_type: "refinancing",
        state: "indicative",
        eligibility_state: "potentially_eligible",
        is_no_action: false,
        reason_codes: ["verified_offer_required"],
        dimensions: {
          total_financial_cost: "120000",
          net_liquidity: "3000000",
          duration_days: 90,
        },
      },
    ],
    tradeoffs: [
      {
        old_obligation_ref: "debt-synthetic-1",
        new_obligation_ref: "offer-synthetic-1",
        close_effective_date: "2026-09-12",
        current_schedule: [{ due_date: "2026-09-20", amount: "650000" }],
        new_schedule: [
          { due_date: "2026-10-20", amount: "500000" },
          { due_date: "2026-11-20", amount: "500000" },
        ],
        current: {
          total_financial_cost: "503076",
          net_liquidity: "0",
          maximum_debt_service: "650000",
          duration_days: 365,
          payment_concentration: "650000",
          guarantees: ["Garantía mobiliaria"],
        },
        proposed: {
          total_financial_cost: "620000",
          net_liquidity: "3000000",
          maximum_debt_service: "500000",
          duration_days: 455,
          payment_concentration: "500000",
          guarantees: ["Garantía personal"],
        },
        total_cost_delta: "116924",
        maximum_service_delta: "-150000",
        duration_delta_days: 90,
        payment_concentration_delta: "-150000",
        guarantees_added: ["Garantía personal"],
        guarantees_removed: [],
      },
    ],
  },
  combinations: {
    combinations: [
      {
        component_codes: ["working-capital:reference", "refinancing:reference"],
        policy_ref: "policy:synthetic",
        applied_rule: "backend_verified",
        dimensions: {
          total_financial_cost: "200000",
          maximum_debt_service: "1500000",
          net_liquidity: "5000000",
          duration_days: 90,
          payment_concentration: "1500000",
          guarantees: ["Garantía combinada"],
        },
      },
    ],
    excluded: [
      {
        component_codes: ["working-capital:reference", "working-capital:no-action"],
        reason_code: "max_combinations_reached",
      },
    ],
    max_components: 2,
    max_combinations: 1,
    truncated: true,
  },
};

export const evaluationAbstenidaV13: FinancingEvaluationContract = {
  ...evaluationV13,
  state: "abstained",
  abstain_reasons: ["verified_scoped_debt_required"],
  working_capital: {
    ...evaluationV13.working_capital,
    state: "abstained",
    reasons: ["verified_offer_required"],
    alternatives: evaluationV13.working_capital.alternatives.map((alternative) => ({
      ...alternative,
      reason_codes: ["verified_offer_required"],
    })),
  },
  refinancing: {
    ...evaluationV13.refinancing,
    state: "observed_only",
    reasons: ["no_cash_gap"],
    tradeoffs: [],
  },
  combinations: {
    combinations: [],
    excluded: [],
    max_components: 2,
    max_combinations: 1,
    truncated: false,
    reason_codes: ["verified_offer_required"],
  },
};

export const overviewCompletoV13: FinancingOverviewContract = {
  ...overviewParcialV13,
  state: "ready",
  reason_codes: [],
  comparable_cost_rate: "0.014",
  verified_available_capacity: "3000000",
  debt_coverage: "complete",
};

export const overviewAbstenidoV13: FinancingOverviewContract = {
  ...overviewParcialV13,
  state: "abstained",
  reason_codes: ["legacy_debt_scope_not_reproducible"],
  outstanding_principal: null,
  remaining_financial_cost: null,
  comparable_cost_rate: null,
  verified_available_capacity: null,
  debt_coverage: "unknown",
  debts: [],
  freshness: { status: "unknown", reason_codes: ["source_freshness_required"] },
};
