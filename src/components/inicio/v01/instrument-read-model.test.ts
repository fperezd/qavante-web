import { describe, expect, it } from "vitest";
import {
  instrumentReadView,
  outcomeLedgerUnavailableView,
  type InstrumentReadSource,
} from "./instrument-read-model";

function source(over: Partial<InstrumentReadSource> = {}): InstrumentReadSource {
  return {
    id: "fx:forward:fixture",
    family: "fx",
    code: "forward",
    state: "not_evaluable",
    isNoAction: false,
    reasonCodes: ["quote_terms_missing"],
    evidenceRefs: [],
    cost: null,
    costCurrency: null,
    validThrough: null,
    ...over,
  };
}

describe("instrument read presentation", () => {
  it("keeps not_evaluable explicit and does not turn unknown cost into zero", () => {
    const view = instrumentReadView(source());
    expect(view).toMatchObject({
      state: "not_evaluable",
      stateLabel: "No evaluable",
      costLabel: "Costo no verificable",
      validityLabel: "Vigencia no informada",
    });
    expect(view.costLabel).not.toContain("0");
  });

  it("formats a known FX cost only with its supplied currency", () => {
    expect(
      instrumentReadView(
        source({ cost: "125.5", costCurrency: "USD", validThrough: "2026-09-08T12:00:00Z" }),
      ),
    ).toMatchObject({
      costLabel: "Costo informado US$ 125,50",
      validityLabel: "Vigente hasta 08-09-2026",
    });
  });

  it("preserves no_action as non-operational", () => {
    expect(
      instrumentReadView(source({ family: "investment", code: "no_action", isNoAction: true })),
    ).toMatchObject({
      costLabel: "Costo de instrumento no aplica",
      validityLabel: "Vigencia de instrumento no aplica",
    });
  });

  it("keeps F9 unavailable instead of fabricating outcomes", () => {
    expect(outcomeLedgerUnavailableView()).toMatchObject({
      outcomeLabel: "Sin dato",
      valueLedgerLabel: "Sin dato",
    });
  });
});
