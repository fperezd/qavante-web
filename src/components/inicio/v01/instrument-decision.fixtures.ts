import {
  collectionContractDependencyView,
  externalDeliveryDisabledLabel,
  financingAlternativeView,
  fxAlternativeView,
  investmentAlternativeView,
  outcomeLedgerContractDependencyView,
  type DecisionLayerView,
} from "./instrument-decision-model";

/** Datos sintéticos exclusivos de tests/stories; no representan ofertas ni providers reales. */
export function instrumentDecisionStoryLayer(): DecisionLayerView {
  return {
    instruments: [
      collectionContractDependencyView(),
      financingAlternativeView("working_capital", {
        code: "working_capital:fixture",
        instrument_type: "working_capital",
        eligibility_state: "eligible",
        reason_codes: ["human_selection_required"],
        is_no_action: false,
        evidence_refs: ["fixture:evidence:working-capital"],
        dimensions: { total_financial_cost: "250000" },
        offer: { currency: "CLP", valid_through: "2026-09-10T12:00:00Z" },
      }),
      financingAlternativeView("refinancing", {
        code: "refinancing:fixture",
        instrument_type: "refinancing",
        eligibility_state: "potentially_eligible",
        reason_codes: ["verified_prepayment_required"],
        is_no_action: false,
        evidence_refs: [],
        dimensions: { total_financial_cost: null },
        offer: null,
      }),
      fxAlternativeView(
        {
          code: "forward",
          eligibility_state: "ineligible",
          reason_codes: ["settlement_date_mismatch"],
          commission_or_cost: "125.50",
          commission_or_cost_currency: "USD",
          evidence_refs: ["fixture:evidence:fx"],
          is_no_action: false,
        },
        { valid_through: "2026-09-08T12:00:00Z" },
      ),
      investmentAlternativeView(
        {
          code: "invest_surplus",
          product_ref: null,
          eligibility_state: "not_evaluable",
          reason_codes: ["verified_product_terms_required"],
          total_cost: null,
          evidence_refs: [],
          is_no_action: false,
        },
        null,
      ),
      financingAlternativeView("working_capital", {
        code: "no_action",
        instrument_type: "no_action",
        eligibility_state: "eligible",
        reason_codes: [],
        is_no_action: true,
        evidence_refs: ["fixture:evidence:cash-need"],
        dimensions: { total_financial_cost: null },
        offer: null,
      }),
    ],
    outcomeLedger: outcomeLedgerContractDependencyView(),
    externalDeliveryLabel: externalDeliveryDisabledLabel("disabled_no_institution"),
  };
}
