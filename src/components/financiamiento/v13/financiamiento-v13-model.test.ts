import { describe, expect, it } from "vitest";
import { financingV13Model, type FinancingOverviewContract } from "./financiamiento-v13-model";
import { evaluationV13 } from "./financiamiento-v13-fixtures";

const OVERVIEW: FinancingOverviewContract = {
  scope: {
    tenant_id: "tenant-1",
    legal_entity_id: "entity-1",
    currency: "CLP",
    as_of: "2026-09-09T12:00:00Z",
  },
  state: "partial",
  reason_codes: ["verified_credit_capacity_required"],
  outstanding_principal: "8503076",
  remaining_financial_cost: "503076",
  comparable_cost_rate: null,
  verified_available_capacity: null,
  debt_coverage: "partial",
  debts: [
    {
      debt_ref: "debt-1",
      instrument_type: "loan",
      counterparty: "Banco de ejemplo",
      outstanding_principal: "8503076",
      contract_rate_type: "fixed_monthly",
      contract_rate_value: "0.014",
      remaining_financial_cost: "503076",
      next_payment_date: "2026-09-20",
      next_payment_amount: "650000",
      maturity_date: "2027-09-20",
      source_refs: ["decision:1"],
    },
  ],
  freshness: { status: "fresh", observed_at: "2026-09-09T11:00:00Z" },
  source_refs: ["decision:1"],
  snapshot_hash: "a".repeat(64),
};

const EVALUATION = evaluationV13;

describe("financingV13Model", () => {
  it("publica exclusivamente las cifras del read model y conserva la moneda", () => {
    const model = financingV13Model(OVERVIEW, EVALUATION);

    expect(model.currency).toBe("CLP");
    expect(model.principal).toBe(8_503_076);
    expect(model.remainingCost).toBe(503_076);
    expect(model.availableCapacity).toBeNull();
    expect(model.comparableRatePct).toBeNull();
    expect(model.evidenceLabel).toBe("1 referencia de fuente");
    expect(model.debts[0]).toMatchObject({
      principal: 8_503_076,
      nextPayment: 650_000,
      rateLabel: "1,4% · fija mensual",
    });
  });

  it("concorda las referencias de fuente y no inventa una cuando faltan", () => {
    expect(financingV13Model({ ...OVERVIEW, source_refs: [] }).evidenceLabel).toBe(
      "Fuente sin dato",
    );
    expect(
      financingV13Model({ ...OVERVIEW, source_refs: ["decision:1", "contract:2"] }).evidenceLabel,
    ).toBe("2 referencias de fuente");
  });

  it("traduce tipos de tasa conocidos y no expone códigos internos desconocidos", () => {
    const model = financingV13Model({
      ...OVERVIEW,
      debts: [
        {
          ...OVERVIEW.debts![0]!,
          contract_rate_type: "vendor_private_code",
          instrument_type: "vendor_private_instrument",
        },
      ],
    });

    expect(model.debts[0]?.rateLabel).toBe("1,4%");
    expect(model.debts[0]?.label).toBe("Instrumento financiero · Banco de ejemplo");
  });

  it("no convierte ausencia, negativo ni decimal inválido en cero", () => {
    const model = financingV13Model({
      ...OVERVIEW,
      outstanding_principal: null,
      remaining_financial_cost: "-1",
      comparable_cost_rate: "n/a",
      verified_available_capacity: null,
      debts: [{ ...OVERVIEW.debts![0]!, outstanding_principal: "n/a" }],
    });

    expect(model.principal).toBeNull();
    expect(model.remainingCost).toBeNull();
    expect(model.comparableRatePct).toBeNull();
    expect(model.availableCapacity).toBeNull();
    expect(model.debts).toHaveLength(0);
  });

  it("no suma alternativas ni convierte referencias en ofertas", () => {
    const model = financingV13Model(OVERVIEW, EVALUATION);

    expect(model.alternatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "No financiar",
          stateLabel: "Comparable",
          eligibilityLabel: "Elegible",
          isNoAction: true,
        }),
        expect.objectContaining({
          label: "Refinanciamiento",
          stateLabel: "Referencia indicativa",
          eligibilityLabel: "Elegibilidad por verificar",
          cost: 120_000,
          netLiquidity: 3_000_000,
        }),
      ]),
    );
    expect(model.alternatives).toHaveLength(3);
    expect(model.alternatives.map((item) => item.stateLabel)).toContain("Referencia indicativa");
  });

  it("una alternativa ejecutable en el contrato sigue rotulada como sólo lectura", () => {
    const model = financingV13Model(OVERVIEW, {
      ...EVALUATION,
      working_capital: {
        ...EVALUATION.working_capital,
        alternatives: [{ ...EVALUATION.working_capital.alternatives[0]!, state: "executable" }],
      },
    });

    expect(model.alternatives[0]?.stateLabel).toBe("Verificada · sólo lectura");
  });

  it.each([
    ["eligible", "Elegible"],
    ["potentially_eligible", "Elegibilidad por verificar"],
    ["ineligible", "No elegible"],
    ["not_evaluable", "Elegibilidad no evaluable"],
  ] as const)("conserva eligibility_state %s como %s", (eligibilityState, expectedLabel) => {
    const model = financingV13Model(OVERVIEW, {
      ...EVALUATION,
      working_capital: {
        ...EVALUATION.working_capital,
        alternatives: [
          {
            ...EVALUATION.working_capital.alternatives[0]!,
            eligibility_state: eligibilityState,
          },
        ],
      },
    });

    expect(model.alternatives[0]?.eligibilityLabel).toBe(expectedLabel);
  });

  it("muestra abstención con razones y sin cifras inventadas", () => {
    const model = financingV13Model({
      ...OVERVIEW,
      state: "abstained",
      reason_codes: ["legacy_debt_scope_not_reproducible"],
      outstanding_principal: null,
      remaining_financial_cost: null,
      debts: [],
      freshness: { status: "unknown", reason_codes: ["source_freshness_required"] },
    });

    expect(model.state).toBe("abstained");
    expect(model.reasons).toContain(
      "La deuda histórica no tiene una entidad legal y moneda reproducibles.",
    );
    expect(model.freshnessLabel).toBe("Frescura sin dato");
    expect(model.principal).toBeNull();
  });

  it("traduce códigos conocidos y neutraliza uno desconocido sin inventar su causa", () => {
    const model = financingV13Model({
      ...OVERVIEW,
      reason_codes: ["verified_credit_capacity_required", "new_backend_reason"],
    });

    expect(model.reasons).toEqual([
      "Falta una capacidad de crédito verificada.",
      "La fuente informó una limitación todavía no identificada.",
    ]);
  });

  it("conserva estados y motivos de abstención en cada evaluación", () => {
    const model = financingV13Model(OVERVIEW, {
      ...EVALUATION,
      state: "abstained",
      abstain_reasons: ["verified_scoped_debt_required"],
      working_capital: {
        ...EVALUATION.working_capital,
        state: "abstained",
        reasons: ["verified_offer_required"],
      },
      refinancing: {
        ...EVALUATION.refinancing,
        state: "observed_only",
        reasons: ["new_backend_reason"],
      },
    });

    expect(model.evaluation).toMatchObject({
      stateLabel: "No evaluable",
      reasons: ["Falta deuda verificada para esta entidad legal y moneda."],
      scopes: [
        {
          label: "Capital de trabajo",
          stateLabel: "No evaluable",
          reasons: ["Falta una oferta verificada para comparar esta alternativa."],
        },
        {
          label: "Refinanciamiento",
          stateLabel: "Sólo observado",
          reasons: ["La fuente informó una limitación todavía no identificada."],
        },
      ],
    });
  });

  it("publica combinaciones y tradeoffs sin recomponer sus cifras", () => {
    const model = financingV13Model(OVERVIEW, EVALUATION);

    expect(model.combinations).toEqual([
      expect.objectContaining({
        componentLabels: ["Capital de trabajo", "Refinanciamiento"],
        appliedRule: "backend_verified",
        policyRef: "policy:synthetic",
        cost: 200_000,
        netLiquidity: 5_000_000,
        maximumDebtService: 1_500_000,
        durationDays: 90,
        paymentConcentration: 1_500_000,
        guarantees: ["Garantía combinada"],
      }),
    ]);
    expect(model.evaluation).toMatchObject({
      excludedCombinationCount: 1,
      combinationsTruncated: true,
      maxCombinations: 1,
      excludedCombinationReasons: ["La evaluación alcanzó el máximo de combinaciones permitido."],
    });
    expect(model.tradeoffs).toEqual([
      expect.objectContaining({
        totalCostDelta: 116_924,
        maximumServiceDelta: -150_000,
        durationDeltaDays: 90,
        paymentConcentrationDelta: -150_000,
        current: {
          totalFinancialCost: 503_076,
          netLiquidity: 0,
          maximumDebtService: 650_000,
          durationDays: 365,
          paymentConcentration: 650_000,
          guarantees: ["Garantía mobiliaria"],
        },
        proposed: {
          totalFinancialCost: 620_000,
          netLiquidity: 3_000_000,
          maximumDebtService: 500_000,
          durationDays: 455,
          paymentConcentration: 500_000,
          guarantees: ["Garantía personal"],
        },
        currentSchedule: [{ dueDateLabel: "20-09-2026", amount: 650_000 }],
        proposedSchedule: [
          { dueDateLabel: "20-10-2026", amount: 500_000 },
          { dueDateLabel: "20-11-2026", amount: 500_000 },
        ],
        currentPaymentCount: 1,
        proposedPaymentCount: 2,
        guaranteesAdded: ["Garantía personal"],
      }),
    ]);
  });

  it("mantiene dimensiones y montos de calendario desconocidos como null", () => {
    const tradeoff = EVALUATION.refinancing.tradeoffs![0]!;
    const model = financingV13Model(OVERVIEW, {
      ...EVALUATION,
      combinations: {
        ...EVALUATION.combinations,
        combinations: EVALUATION.combinations.combinations?.map((combination) => ({
          ...combination,
          dimensions: {},
        })),
      },
      refinancing: {
        ...EVALUATION.refinancing,
        tradeoffs: [
          {
            ...tradeoff,
            current: {},
            proposed: {},
            current_schedule: [{ due_date: "2026-10-14", amount: "sin-dato" }],
            new_schedule: [{ due_date: "2026-11-15", amount: "sin-dato" }],
          },
        ],
      },
    });

    expect(model.combinations[0]).toMatchObject({
      cost: null,
      netLiquidity: null,
      maximumDebtService: null,
      durationDays: null,
      paymentConcentration: null,
      guarantees: null,
    });
    expect(model.tradeoffs[0]?.current).toEqual({
      totalFinancialCost: null,
      netLiquidity: null,
      maximumDebtService: null,
      durationDays: null,
      paymentConcentration: null,
      guarantees: null,
    });
    expect(model.tradeoffs[0]?.proposed).toEqual(model.tradeoffs[0]?.current);
    expect(model.tradeoffs[0]?.currentSchedule[0]?.amount).toBeNull();
    expect(model.tradeoffs[0]?.proposedSchedule[0]?.amount).toBeNull();
  });
});
