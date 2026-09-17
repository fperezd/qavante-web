import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { financingV13Model, type FinancingEvaluationContract } from "./financiamiento-v13-model";
import {
  evaluationAbstenidaV13,
  evaluationV13,
  overviewAbstenidoV13,
  overviewCompletoV13,
  overviewParcialV13,
} from "./financiamiento-v13-fixtures";
import { FinanciamientoV13View } from "./financiamiento-v13-view";

function html(overview = overviewParcialV13, withEvaluation = true): string {
  return renderToStaticMarkup(
    <FinanciamientoV13View
      model={financingV13Model(overview, withEvaluation ? evaluationV13 : null)}
    />,
  );
}

function evaluationHtml(evaluation: FinancingEvaluationContract): string {
  return renderToStaticMarkup(
    <FinanciamientoV13View model={financingV13Model(overviewCompletoV13, evaluation)} />,
  );
}

describe("FinanciamientoV13View", () => {
  it("muestra deuda verificada sin inventar tasa ni cupo", () => {
    const rendered = html();
    const zeroValue = /\$0<\/div>/;

    expect("<div>$0</div>").toMatch(zeroValue);
    expect(rendered).toContain("$8.503.076");
    expect(rendered).toContain("Banco de ejemplo");
    expect(rendered).toContain("Por qué no sabemos tasa");
    expect(rendered).toContain("Por qué no sabemos cupo disponible");
    expect(rendered).not.toMatch(zeroValue);
    expect(rendered).toContain("$650.000");
  });

  it("rotula lo indicativo como referencia sin explicaciones adicionales", () => {
    const rendered = html();

    expect(rendered).toContain("Referencia indicativa");
    expect(rendered).toContain("No financiar");
    expect(rendered).not.toContain("no se puede aceptar desde Qavante");
    expect(rendered).not.toContain("La opción de no financiar");
  });

  it("oculta estados internos, motivos y razones de cada alternativa", () => {
    const rendered = renderToStaticMarkup(
      <FinanciamientoV13View
        model={financingV13Model(overviewParcialV13, evaluationAbstenidaV13)}
      />,
    );

    expect(rendered).not.toContain("Estado de la evaluación");
    expect(rendered).not.toContain("Falta deuda verificada");
    expect(rendered).not.toContain("Motivos ·");
    expect(rendered).not.toContain("Elegibilidad ·");
  });

  it("no publica la elegibilidad interna", () => {
    const alternative = evaluationV13.working_capital.alternatives[0]!;
    const rendered = evaluationHtml({
      ...evaluationV13,
      working_capital: {
        ...evaluationV13.working_capital,
        alternatives: [{ ...alternative, eligibility_state: "ineligible" }],
      },
    });

    expect(rendered).toContain("Comparable");
    expect(rendered).not.toContain("Elegibilidad · No elegible");
  });

  it("neutraliza un código de motivo desconocido", () => {
    const alternative = evaluationV13.working_capital.alternatives[0]!;
    const rendered = evaluationHtml({
      ...evaluationV13,
      working_capital: {
        ...evaluationV13.working_capital,
        alternatives: [{ ...alternative, reason_codes: ["reviewer_unknown_code_237"] }],
      },
    });

    expect(rendered).not.toContain("La fuente informó una limitación todavía no identificada.");
    expect(rendered).not.toContain("reviewer_unknown_code_237");
  });

  it("oculta combinaciones y conserva los cambios principales", () => {
    const rendered = html(overviewCompletoV13);

    expect(rendered).not.toContain("Combinaciones verificadas");
    expect(rendered).not.toContain("Capital de trabajo + Refinanciamiento");
    expect(rendered).not.toContain("1 combinación excluida en esta evaluación");
    expect(rendered).toContain("Comparar refinanciamiento");
    expect(rendered).toContain("$116.924");
    expect(rendered).toContain("−$150.000");
    expect(rendered).toContain("+90 días");
    expect(rendered).toContain("Ver cuotas");
  });

  it("no muestra la concentración interna de combinaciones", () => {
    const evaluation: FinancingEvaluationContract = {
      ...evaluationV13,
      combinations: {
        ...evaluationV13.combinations,
        combinations: evaluationV13.combinations.combinations?.map((combination) => ({
          ...combination,
          dimensions: { ...combination.dimensions, payment_concentration: "7654321" },
        })),
      },
    };
    const rendered = evaluationHtml(evaluation);

    expect(rendered).not.toContain("Concentración de pagos");
    expect(rendered).not.toContain("$7.654.321");
  });

  it("no expone las referencias internas que respaldan cada combinación", () => {
    const combination = evaluationV13.combinations.combinations![0]!;
    const rendered = evaluationHtml({
      ...evaluationV13,
      combinations: {
        ...evaluationV13.combinations,
        combinations: [
          {
            ...combination,
            applied_rule: "regla_review_237",
            policy_ref: "policy:review:237",
          },
        ],
      },
    });

    expect(rendered).not.toContain("Criterios de evaluación verificados");
    expect(rendered).not.toContain("regla_review_237");
    expect(rendered).not.toContain("policy:review:237");
  });

  it("muestra las cifras principales de la comparación", () => {
    const tradeoff = evaluationV13.refinancing.tradeoffs![0]!;
    const evaluation: FinancingEvaluationContract = {
      ...evaluationV13,
      refinancing: {
        ...evaluationV13.refinancing,
        tradeoffs: [
          {
            ...tradeoff,
            current: {
              total_financial_cost: "111111",
              net_liquidity: "122222",
              maximum_debt_service: "133333",
              duration_days: 144,
              payment_concentration: "155555",
              guarantees: ["Garantía actual única"],
            },
            proposed: {
              total_financial_cost: "211111",
              net_liquidity: "222222",
              maximum_debt_service: "233333",
              duration_days: 244,
              payment_concentration: "255555",
              guarantees: ["Garantía propuesta única"],
            },
          },
        ],
      },
    };
    const rendered = evaluationHtml(evaluation);

    const actual = rendered.slice(rendered.indexOf(">Actual<"), rendered.indexOf(">Propuesta<"));
    const proposed = rendered.slice(
      rendered.indexOf(">Propuesta<"),
      rendered.indexOf("Cambio en costo"),
    );

    expect(actual).toContain("$111.111");
    expect(actual).toContain("$122.222");
    expect(actual).toContain("144 días");
    expect(actual).not.toContain("Garantía actual única");
    expect(proposed).toContain("$211.111");
    expect(proposed).toContain("$222.222");
    expect(proposed).toContain("244 días");
    expect(proposed).not.toContain("Garantía propuesta única");
  });

  it("muestra fechas y montos exactos de ambos calendarios", () => {
    const tradeoff = evaluationV13.refinancing.tradeoffs![0]!;
    const evaluation: FinancingEvaluationContract = {
      ...evaluationV13,
      refinancing: {
        ...evaluationV13.refinancing,
        tradeoffs: [
          {
            ...tradeoff,
            current_schedule: [{ due_date: "2026-10-14", amount: "341987" }],
            new_schedule: [{ due_date: "2026-11-15", amount: "428765" }],
          },
        ],
      },
    };
    const rendered = evaluationHtml(evaluation);

    expect(rendered).toContain("Cuotas actuales");
    expect(rendered).toContain("Cuotas propuestas");
    expect(rendered).toContain("14-10-2026");
    expect(rendered).toContain("15-11-2026");
    expect(rendered).toContain("$341.987");
    expect(rendered).toContain("$428.765");
  });

  it("en estado completo publica la tasa y el cupo del backend", () => {
    const rendered = html(overviewCompletoV13);

    expect(rendered).toContain("1,4%");
    expect(rendered).toContain("$3.000.000");
    expect(rendered).not.toContain("Capacidad verificada · no es una oferta");
  });

  it("la tabla desplazable es alcanzable por teclado en móvil", () => {
    const rendered = html(overviewCompletoV13);

    expect(rendered).toContain('role="region"');
    expect(rendered).toContain('aria-label="Detalle de préstamos"');
    expect(rendered).toContain('tabindex="0"');
  });

  it("en abstención muestra motivos y ningún monto principal plausible", () => {
    const rendered = html(overviewAbstenidoV13, false);
    const knownPrincipal = /\$8\.503\.076/;

    expect(html(overviewCompletoV13)).toMatch(knownPrincipal);
    expect(rendered).toContain("Faltan datos de algunos préstamos.");
    expect(rendered).toContain("Por qué no sabemos deuda total");
    expect(rendered).toContain("No hay préstamos para mostrar.");
    expect(rendered).not.toMatch(knownPrincipal);
    expect(rendered).not.toContain("no acepta ofertas, no firma y no mueve");
  });

  it.each([
    ["completo", overviewCompletoV13],
    ["parcial", overviewParcialV13],
    ["abstenido", overviewAbstenidoV13],
  ])("Ley 2 · %s no agrega clases rojas", (_name, overview) => {
    const rendered = html(overview);
    expect(rendered.match(/(?:text|bg|border)-rediseno-rojo/g) ?? []).toHaveLength(0);
  });
});
