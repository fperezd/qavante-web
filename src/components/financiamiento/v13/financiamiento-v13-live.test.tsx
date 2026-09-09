import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const arnes = vi.hoisted(() => ({
  evaluation: {
    data: { state: "ready" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

const consulta = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

vi.mock("@/lib/api/dashboard", () => ({
  useDashboardSummary: () => consulta({ generated_at: "2026-09-09T12:00:00Z" }),
}));

vi.mock("@/lib/api/financial-scope", () => ({
  useFinancialScope: () => consulta({ legal_entity_id: "entity-1", currency: "CLP" }),
  toFinancialDecisionReadScope: () => ({
    legal_entity_id: "entity-1",
    currency: "CLP",
    as_of: "2026-09-09T12:00:00Z",
  }),
}));

vi.mock("@/lib/api/financing", () => ({
  useFinancingOverview: () =>
    consulta({
      scope: { legal_entity_id: "entity-1", currency: "CLP", as_of: "2026-09-09T12:00:00Z" },
      state: "ready",
      debt_coverage: "complete",
      freshness: { status: "fresh" },
      snapshot_hash: "a".repeat(64),
    }),
  useWorkingCapitalRefinancingEvaluation: () => arnes.evaluation,
  toFinancingEvaluation: () => ({
    state: "ready",
    working_capital: { alternatives: [] },
    refinancing: { alternatives: [] },
    combinations: { combinations: [], excluded: [], truncated: false },
  }),
}));

vi.mock("./financiamiento-v13-view", () => ({
  FinanciamientoV13View: () => <p>Vista de financiamiento lista</p>,
}));

import { FinanciamientoV13Live } from "./financiamiento-v13-live";

const READY_VIEW = /Vista de financiamiento lista/;

describe("FinanciamientoV13Live · ausencia de evaluación", () => {
  beforeEach(() => {
    arnes.evaluation.data = { state: "ready" };
    arnes.evaluation.isLoading = false;
    arnes.evaluation.isError = false;
    arnes.evaluation.refetch.mockReset();
  });

  it("mantiene la carga hasta conocer las alternativas", () => {
    arnes.evaluation.isLoading = true;

    const html = renderToStaticMarkup(<FinanciamientoV13Live />);

    expect(html).toContain("Consultando deuda, costo y capacidad");
    expect(html).not.toMatch(READY_VIEW);
  });

  it("declara el error y no lo convierte en una abstención plausible", () => {
    arnes.evaluation.isError = true;

    const html = renderToStaticMarkup(<FinanciamientoV13Live />);

    expect(html).toContain("alternativas verificables de financiamiento");
    expect(html).toContain("No presentamos alternativas ni convertimos esa ausencia");
    expect(html).not.toMatch(READY_VIEW);
  });

  it("entrega la vista sólo con la evaluación disponible", () => {
    const html = renderToStaticMarkup(<FinanciamientoV13Live />);

    expect(html).toMatch(READY_VIEW);
  });
});
