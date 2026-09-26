import { describe, expect, it } from "vitest";
import type { DecisionPlan } from "@/lib/api/decision-plans";
import type { CashProjectionRun, CashProjectionScenario } from "@/lib/api/cash-projection-runs";
import {
  formatContractMoney,
  paymentPlanMatchesProjection,
  projectionState,
  selectProjectionSnapshot,
} from "./cash-projection-run-model";

function scenario(over: Partial<CashProjectionScenario> = {}): CashProjectionScenario {
  return {
    scenario_id: "scheduled_expected_v1",
    scenario_name: "scheduled_expected_v1",
    opening_cash: "10000000",
    inflows_total: "5000000",
    outflows_total: "12000000",
    ending_cash: "3000000",
    minimum_cash: "-1000000",
    minimum_cash_date: "2026-09-12",
    gap_against_zero: "1000000",
    assumptions: {
      cash_balance_timing: "closing",
      minimum_definition: "minimum daily closing cash",
      gap_definition: "max(0,-minimum_cash)",
      overdue_payables: "included once",
      arrears_recovery: "none",
      recurring_income: "none",
    },
    exclusions: [],
    source_coverage: [
      {
        required_source_ref: "accounts_payable",
        state: "current",
        reason_codes: [],
        catalog_version: "d10-v1",
        evaluated_at: "2026-09-08T12:00:00Z",
        valid_through: "2026-09-08",
        observed_count: 2,
      },
    ],
    series: [],
    bridge: {
      coverage: {
        status: "current",
        decision_support: "eligible",
        coverage_valid_through: "2026-09-22",
      },
      components: [],
      component_count: 0,
    },
    scenario_digest: "c".repeat(64),
    ...over,
  };
}

function run(item = scenario()): CashProjectionRun {
  return {
    projection_run_id: "11111111-1111-4111-8111-111111111111",
    input_digest: "a".repeat(64),
    legal_entity_id: "11111111-1111-4111-8111-111111111111",
    v14_generation_id: "22222222-2222-4222-8222-222222222222",
    v14_projection_snapshot_id: "33333333-3333-4333-8333-333333333333",
    cutoff_at: "2026-09-08T12:00:00Z",
    as_of: "2026-09-08",
    horizon_days: 14,
    currency: "CLP",
    calculation_version: "cash-projection-run-v1",
    decision_support: "abstain",
    scenarios: [
      item,
      scenario({ scenario_id: "outflows_only_v1", scenario_name: "outflows_only_v1" }),
      scenario({
        scenario_id: "scheduled_with_arrears_recovery_v1",
        scenario_name: "scheduled_with_arrears_recovery_v1",
      }),
      scenario({
        scenario_id: "scheduled_with_recurring_income_v1",
        scenario_name: "scheduled_with_recurring_income_v1",
      }),
    ],
  };
}

describe("cash projection run model", () => {
  it("mantiene ending positivo, mínimo negativo y brecha separados sin recalcular", () => {
    const r = run();
    const view = selectProjectionSnapshot(r, {
      runId: r.projection_run_id,
      calculationVersion: r.calculation_version,
      scenarioId: "scheduled_expected_v1",
    });
    expect(view?.scenario.ending_cash).toBe("3000000");
    expect(view?.scenario.minimum_cash).toBe("-1000000");
    expect(view?.scenario.gap_against_zero).toBe("1000000");
    expect(view?.scenario.outflows_total).toBe("12000000");
  });

  it("bridge manda y una cobertura vencida se presenta stale con reloj Santiago", () => {
    const now = new Date("2026-09-23T02:59:59Z"); // 22-sep todavía en Santiago
    expect(
      projectionState(
        scenario({
          bridge: {
            coverage: {
              status: "partial",
              decision_support: "abstain",
              coverage_valid_through: null,
            },
            components: [],
            component_count: 0,
          },
        }),
        now,
      ),
    ).toBe("partial");
    expect(
      projectionState(
        scenario({
          source_coverage: [{ ...scenario().source_coverage[0]!, state: "stale" }],
        }),
        now,
      ),
    ).toBe("current");
    expect(projectionState(scenario({ source_coverage: [] }), now)).toBe("current");

    /* Cada pierna del guard, SOLA: si una se borra, este bloque muere. */
    const cobertura = (over: Partial<CashProjectionScenario["bridge"]["coverage"]>) =>
      scenario({
        bridge: {
          coverage: {
            status: "current",
            decision_support: "eligible",
            coverage_valid_through: "2026-09-22",
            ...over,
          },
          components: [],
          component_count: 0,
        },
      });
    // Sólo `status: "partial"` (soporte elegible y vigencia futura).
    expect(projectionState(cobertura({ status: "partial" }), now)).toBe("partial");
    // Sólo `decision_support: "abstain"` (estado vigente y vigencia futura).
    expect(projectionState(cobertura({ decision_support: "abstain" }), now)).toBe("partial");
    // Sólo vigencia ausente.
    expect(projectionState(cobertura({ coverage_valid_through: null }), now)).toBe("partial");
    // Gemelo positivo: sin ninguna degradación, la MISMA cobertura es vigente.
    expect(projectionState(cobertura({}), now)).toBe("current");
    expect(
      projectionState(
        scenario({
          source_coverage: [
            {
              ...scenario().source_coverage[0]!,
              observed_count: 0,
              valid_through: null,
            },
          ],
        }),
        now,
      ),
    ).toBe("current");
    expect(
      projectionState(
        scenario({
          bridge: {
            ...scenario().bridge,
            coverage: {
              ...scenario().bridge.coverage,
              coverage_valid_through: null,
            },
          },
        }),
        now,
      ),
    ).toBe("partial");
    expect(projectionState(scenario(), new Date("2026-09-23T03:00:00Z"))).toBe("stale");
  });

  it("rechaza una selección atrasada de otro run o versión", () => {
    const r = run();
    expect(
      selectProjectionSnapshot(r, {
        runId: "otro",
        calculationVersion: r.calculation_version,
        scenarioId: "scheduled_expected_v1",
      }),
    ).toBeNull();
  });

  it("formatea strings sin Number", () => {
    expect(formatContractMoney("-1234567.500000", "CLP")).toBe("−$1.234.567,5");
    expect(formatContractMoney("1234.25", "USD")).toBe("USD 1.234,25");
  });

  it("acepta un plan sólo si coincide toda la referencia H=14", () => {
    const r = run();
    const view = selectProjectionSnapshot(
      r,
      {
        runId: r.projection_run_id,
        calculationVersion: r.calculation_version,
        scenarioId: "scheduled_expected_v1",
      },
      "2026-09-22",
    );
    const plan = {
      projection_reference: {
        run: r.projection_run_id,
        scenario: "scheduled_expected_v1",
        calculation_version: r.calculation_version,
        input_digest: r.input_digest,
        as_of: r.as_of,
        horizon_days: 14,
        coverage_valid_through: "2026-09-22",
      },
    } as DecisionPlan;
    expect(paymentPlanMatchesProjection(plan, view)).toBe(true);
    const mismatches: Array<Partial<NonNullable<DecisionPlan["projection_reference"]>>> = [
      { run: "99999999-9999-4999-8999-999999999999" },
      { scenario: "outflows_only_v1" },
      { calculation_version: "otra-version" },
      { input_digest: "9".repeat(64) },
      { as_of: "2026-09-07" },
      { horizon_days: 90 },
      { coverage_valid_through: "2026-09-21" },
    ];
    for (const mismatch of mismatches) {
      expect(
        paymentPlanMatchesProjection(
          {
            ...plan,
            projection_reference: { ...plan.projection_reference!, ...mismatch },
          },
          view,
        ),
      ).toBe(false);
    }
    expect(paymentPlanMatchesProjection({ ...plan, projection_reference: null }, view)).toBe(false);

    /* La referencia coincide BYTE A BYTE y el plan igual se rechaza: la foto dejó de estar
       vigente al pasar su `coverage_valid_through`. Sin el guard de estado, esto pasaría. */
    const vencida = selectProjectionSnapshot(
      r,
      {
        runId: r.projection_run_id,
        calculationVersion: r.calculation_version,
        scenarioId: "scheduled_expected_v1",
      },
      "2026-09-23",
    );
    expect(vencida?.state).toBe("stale");
    expect(vencida?.scenario.bridge.coverage.decision_support).toBe("eligible");
    expect(paymentPlanMatchesProjection(plan, vencida)).toBe(false);
    // Gemelo positivo con la MISMA referencia un día antes del corte de vigencia.
    const vigente = selectProjectionSnapshot(
      r,
      {
        runId: r.projection_run_id,
        calculationVersion: r.calculation_version,
        scenarioId: "scheduled_expected_v1",
      },
      "2026-09-22",
    );
    expect(vigente?.state).toBe("current");
    expect(paymentPlanMatchesProjection(plan, vigente)).toBe(true);

    /* Misma referencia, foto vigente, pero el productor se ABSTIENE de sustentar decisiones.
       Sin el guard de `decision_support`, esto pasaría. */
    const sinSoporte: typeof view = {
      ...view!,
      state: "current",
      scenario: {
        ...view!.scenario,
        bridge: {
          ...view!.scenario.bridge,
          coverage: { ...view!.scenario.bridge.coverage, decision_support: "abstain" },
        },
      },
    };
    expect(sinSoporte!.state).toBe("current");
    expect(paymentPlanMatchesProjection(plan, sinSoporte)).toBe(false);
    // Gemelo positivo: la MISMA vista con el soporte elegible sí acepta el plan.
    expect(
      paymentPlanMatchesProjection(plan, {
        ...sinSoporte!,
        scenario: {
          ...sinSoporte!.scenario,
          bridge: {
            ...sinSoporte!.scenario.bridge,
            coverage: {
              ...sinSoporte!.scenario.bridge.coverage,
              decision_support: "eligible",
            },
          },
        },
      }),
    ).toBe(true);

    const excluded = selectProjectionSnapshot(
      run(
        scenario({
          exclusions: [
            {
              source_ref: "recurrence:missing",
              reason: "recurring_income_not_durable",
              cash_relevant: true,
              scenario_ids: ["scheduled_expected_v1"],
            },
          ],
          bridge: {
            ...scenario().bridge,
            coverage: {
              status: "partial",
              decision_support: "abstain",
              coverage_valid_through: null,
            },
          },
        }),
      ),
      {
        runId: r.projection_run_id,
        calculationVersion: r.calculation_version,
        scenarioId: "scheduled_expected_v1",
      },
    );
    expect(excluded?.state).toBe("partial");
    expect(paymentPlanMatchesProjection(plan, excluded)).toBe(false);
  });
});
