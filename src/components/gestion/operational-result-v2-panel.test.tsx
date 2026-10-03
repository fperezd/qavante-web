import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationalResultV2Response } from "@/lib/api/gestion";
import { OperationalResultV2View } from "./operational-result-v2-panel";

function fixture(): OperationalResultV2Response {
  const scope = {
    period_from: "2026-06-01",
    period_to: "2026-08-31",
    as_of: "2026-09-03T12:00:00Z",
    timezone: "America/Santiago" as const,
  };
  return {
    as_of: scope.as_of,
    calculation_version: "v2.2026-09-08",
    definition_id: "qavante.period_statement.v2",
    scope,
    authority: { source: "treasury.operating_metric_snapshots", snapshot_id: "snap-1" },
    coverage: { status: "available", decision_support: "eligible", reason_codes: [] },
    statement_v2: {
      definition_id: "qavante.period_statement.v2",
      version: "v2.2026-09-08",
      basis: "accrual",
      reporting_currency: "CLP",
      sign_convention: "expense_magnitudes",
      scope,
      revenue: "10000000",
      direct_cost: {
        definition_id: "bo.direct_cost.compound.v1",
        base: "2000000",
        remunerations: "1000000",
        professional_fees: "500000",
        total: "3500000",
        operating_natures: {
          base: "direct_cost",
          remunerations: "direct_cost",
          professional_fees: "direct_cost",
        },
      },
      base_breakdown: { cogs: "1500000", direct_labor: "500000" },
      recurring_expenses: "2000000",
      unclassified: "300000",
      unclassified_purchases: "100000",
      unclassified_breakdown: {
        foreign_purchases: "100000",
        obligations: "200000",
        total: "300000",
      },
      financial_expense: "200000",
      result_before_financial: "4100000",
      result_after_financial: "3900000",
      coverage: {
        status: "complete",
        decision_support: "eligible",
        omitted_count: 0,
        reason_codes: [],
      },
      source_coverage: [{ source: "sii_rcv.sales", state: "current", reason_codes: [] }],
      required_source_refs: ["sii_rcv.sales"],
      omitted_lines: [],
    },
  };
}

describe("OperationalResultV2View", () => {
  it("presenta la definición aprobada y sus componentes sin doble suma", () => {
    const text = renderToStaticMarkup(<OperationalResultV2View response={fixture()} />);
    expect(text).toContain("Resultado operacional");
    // "canónico" es vocabulario interno: no vuelve a pantalla (issue de copy, 2026-10-03).
    expect(text).not.toContain("canónic");
    expect(text).toContain("Costo Directo");
    expect(text).toContain("$3.500.000");
    expect(text).toContain("Remuneraciones");
    expect(text).toContain("$1.000.000");
    expect(text).toContain("Honorarios");
    expect(text).toContain("$500.000");
    expect(text).toContain("Compras sin clasificar");
    expect(text).toContain("$100.000");
    expect(text).toContain("Otras partidas sin clasificar");
    expect(text).toContain("$300.000");
    expect(text).toContain("$4.100.000");
    expect(text).toContain("$3.900.000");
    expect(text).toContain("se suman una sola vez");
    expect(text).toContain("Apto para decidir");
  });

  it("se abstiene sin fabricar un cero cuando no hay statement", () => {
    const response = fixture();
    response.statement_v2 = null;
    response.coverage = {
      status: "unavailable",
      decision_support: "abstain",
      reason_codes: ["required_source_missing"],
    };
    const text = renderToStaticMarkup(<OperationalResultV2View response={response} />);
    expect(text).toContain("se abstuvo de publicar");
    expect(text).not.toContain("canónic");
    expect(text).not.toContain("$0");
    expect(text).not.toContain("required_source_missing");
  });

  it("declara partidas omitidas sin exponer códigos internos", () => {
    const response = fixture();
    response.statement_v2!.coverage = {
      status: "partial",
      decision_support: "abstain",
      omitted_count: 2,
      reason_codes: ["unvalued_period_lines"],
    };
    const text = renderToStaticMarkup(<OperationalResultV2View response={response} />);
    expect(text).toContain("2 partidas quedaron fuera");
    expect(text).toContain("no usar para decidir");
    expect(text).not.toContain("unvalued_period_lines");
  });

  it("un monto ilegible se declara 'Sin dato'; nunca se convierte en $0", () => {
    const data = fixture();
    const roto: OperationalResultV2Response = {
      ...data,
      statement_v2: {
        ...data.statement_v2!,
        revenue: "no-es-un-decimal",
        direct_cost: { ...data.statement_v2!.direct_cost, total: "" },
      },
    };
    const html = renderToStaticMarkup(<OperationalResultV2View response={roto} />);

    /* El mutante `parseAmountOrNull(value) ?? 0` pintaría "$0" en las dos métricas: un cero
       inventado sobre plata. Acá tiene que decir que no sabe. */
    expect(html).toContain("Sin dato");
    expect(html).not.toContain("$0<");
    // Gemelo positivo con el MISMO render: los montos legibles sí se publican.
    const sano = renderToStaticMarkup(<OperationalResultV2View response={data} />);
    expect(sano).toContain("$10.000.000");
    expect(sano).not.toContain("Sin dato");
  });
});
