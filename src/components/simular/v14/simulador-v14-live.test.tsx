import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SimuladorV14ViewProps } from "./simulador-v14-view";

const harness = vi.hoisted(() => ({
  viewProps: undefined as SimuladorV14ViewProps | undefined,
  mutate: vi.fn(),
  summary: {
    data: { generated_at: "2026-09-09T12:34:56Z" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  financialScope: {
    data: {
      legal_entity_id: "20000000-0000-4000-8000-000000000014",
      functional_currency_code: "CLP",
      as_of: "2026-09-09",
    } as
      | {
          legal_entity_id: string;
          functional_currency_code: string;
          as_of: string;
        }
      | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/dashboard", () => ({
  useDashboardSummary: () => harness.summary,
}));

vi.mock("@/lib/api/financial-scope", () => ({
  useFinancialScope: () => harness.financialScope,
  toFinancialDecisionReadScope: (
    scope: { legal_entity_id: string; functional_currency_code: string; as_of: string } | undefined,
  ) =>
    scope
      ? {
          legal_entity_id: scope.legal_entity_id,
          currency: scope.functional_currency_code,
          as_of: scope.as_of,
        }
      : null,
}));

vi.mock("@/lib/api/simulations", () => ({
  useSimulationEvaluate: () => ({
    data: undefined,
    error: null,
    isPending: false,
    mutate: harness.mutate,
  }),
}));

vi.mock("./simulador-v14-view", () => ({
  SimuladorV14View: (props: SimuladorV14ViewProps) => {
    harness.viewProps = props;
    return <p>Simulador live preparado</p>;
  },
}));

import { SimuladorV14Live } from "./simulador-v14-live";

describe("SimuladorV14Live", () => {
  beforeEach(() => {
    harness.viewProps = undefined;
    harness.mutate.mockReset();
    harness.summary.isLoading = false;
    harness.summary.isError = false;
    harness.financialScope.data = {
      legal_entity_id: "20000000-0000-4000-8000-000000000014",
      functional_currency_code: "CLP",
      as_of: "2026-09-09",
    };
    harness.financialScope.isLoading = false;
    harness.financialScope.isError = false;
  });

  it("envía sólo evaluate con scope canónico, corte del servidor y un supuesto estructurado", () => {
    const html = renderToStaticMarkup(<SimuladorV14Live />);
    const suggestion = harness.viewProps?.suggestions[0];

    expect(html).toContain("Simulador live preparado");
    expect(suggestion).toBeDefined();

    harness.viewProps?.onEvaluate(suggestion!.question, suggestion!.assumption);

    expect(harness.mutate).toHaveBeenCalledTimes(1);
    expect(harness.mutate).toHaveBeenCalledWith({
      question: suggestion!.question,
      legal_entity_id: "20000000-0000-4000-8000-000000000014",
      currency: "CLP",
      as_of: "2026-09-09T12:34:56Z",
      horizon_days: 90,
      assumptions: [suggestion!.assumption],
    });
  });

  it("falla cerrado sin scope verificable y no llama evaluate", () => {
    harness.financialScope.data = undefined;

    renderToStaticMarkup(<SimuladorV14Live />);

    expect(harness.viewProps?.suggestions).toEqual([]);
    expect(harness.viewProps?.error).toContain("entidad legal y moneda funcional verificables");
    expect(harness.mutate).not.toHaveBeenCalled();
  });
});
