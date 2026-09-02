import { describe, expect, it } from "vitest";
import {
  externalDeliveryDisabledLabel,
  financingAlternativeView,
  fxAlternativeView,
  investmentAlternativeView,
  outcomeLedgerContractDependencyView,
  type FinancingAlternativeAdapterSource,
  type FxAlternativeAdapterSource,
  type InvestmentAlternativeAdapterSource,
} from "./instrument-decision-model";

function financing(
  over: Partial<FinancingAlternativeAdapterSource> = {},
): FinancingAlternativeAdapterSource {
  return {
    code: "working_capital:offer-1",
    instrument_type: "working_capital",
    eligibility_state: "eligible",
    reason_codes: ["human_selection_required"],
    is_no_action: false,
    evidence_refs: ["evidence:offer-1"],
    dimensions: { total_financial_cost: "250000" },
    offer: { currency: "CLP", valid_through: "2026-09-10T12:00:00Z" },
    ...over,
  };
}

function fx(over: Partial<FxAlternativeAdapterSource> = {}): FxAlternativeAdapterSource {
  return {
    code: "forward",
    eligibility_state: "ineligible",
    reason_codes: ["settlement_date_mismatch"],
    commission_or_cost: "125.50",
    commission_or_cost_currency: "USD",
    evidence_refs: ["quote:fx-1"],
    is_no_action: false,
    ...over,
  };
}

function investment(
  over: Partial<InvestmentAlternativeAdapterSource> = {},
): InvestmentAlternativeAdapterSource {
  return {
    code: "invest_surplus",
    product_ref: null,
    eligibility_state: "not_evaluable",
    reason_codes: ["verified_product_terms_required"],
    total_cost: null,
    evidence_refs: [],
    is_no_action: false,
    ...over,
  };
}

describe("instrument decision presentation boundary F4–F9", () => {
  it("transporta los cuatro estados sin reinterpretarlos", () => {
    const states = [
      financingAlternativeView("working_capital", financing()).eligibilityState,
      financingAlternativeView(
        "refinancing",
        financing({ eligibility_state: "potentially_eligible" }),
      ).eligibilityState,
      fxAlternativeView(fx(), { valid_through: "2026-09-08T12:00:00Z" }).eligibilityState,
      investmentAlternativeView(investment(), null).eligibilityState,
    ];

    expect(states).toEqual(["eligible", "potentially_eligible", "ineligible", "not_evaluable"]);
  });

  it("muestra costo y vigencia sólo cuando el contrato los informa", () => {
    expect(financingAlternativeView("working_capital", financing())).toMatchObject({
      costLabel: "Costo financiero total $250.000",
      validityLabel: "Vigente hasta 10-09-2026",
      evidenceRefs: ["evidence:offer-1"],
      reasonCodes: ["human_selection_required"],
    });

    expect(
      financingAlternativeView(
        "working_capital",
        financing({ dimensions: { total_financial_cost: null }, offer: null }),
      ),
    ).toMatchObject({
      costLabel: "Costo no verificable",
      validityLabel: "Vigencia no informada",
    });
  });

  it("no convierte costo FX incompleto ni costo de inversión unknown en cero", () => {
    const incompleteFx = fxAlternativeView(fx({ commission_or_cost_currency: null }), {
      valid_through: "2026-09-08T12:00:00Z",
    });
    const unknownInvestment = investmentAlternativeView(investment(), null);

    expect(incompleteFx.costLabel).toBe("Costo no verificable");
    expect(incompleteFx.costLabel).not.toContain("0");
    expect(unknownInvestment).toMatchObject({
      costLabel: "Costo no verificable",
      validityLabel: "Vigencia no informada",
      evidenceRefs: [],
    });
    expect(unknownInvestment.costLabel).not.toContain("0");
  });

  it("presenta el costo FX conocido en su moneda exacta", () => {
    const view = fxAlternativeView(fx(), { valid_through: "2026-09-08T12:00:00Z" });

    expect(view.costLabel).toBe("Costo o comisión US$ 125,50");
    expect(view.validityLabel).toBe("Vigente hasta 08-09-2026");
  });

  it("mantiene no_action explícito sin convertirlo en una operación de costo cero", () => {
    const view = financingAlternativeView(
      "refinancing",
      financing({
        code: "no_action",
        instrument_type: "no_action",
        is_no_action: true,
        dimensions: { total_financial_cost: null },
        offer: null,
      }),
    );

    expect(view).toMatchObject({
      id: "refinancing:no_action",
      title: "No actuar",
      isNoAction: true,
      costLabel: "Costo de instrumento no aplica",
      validityLabel: "Vigencia de instrumento no aplica",
    });
    expect(view.costLabel).not.toContain("$0");
  });

  it("declara F9 como dependencia sin fabricar datos", () => {
    expect(outcomeLedgerContractDependencyView()).toMatchObject({
      kind: "dependency",
      dependency: "qavante-api#304",
    });
    expect(outcomeLedgerContractDependencyView().description).toContain("unknown no es cero");
  });

  it("transporta el estado deshabilitado de F8 sin habilitar delivery", () => {
    expect(externalDeliveryDisabledLabel("disabled_no_institution")).toBe(
      "Integraciones externas deshabilitadas · sin envío ni ejecución",
    );
  });
});
