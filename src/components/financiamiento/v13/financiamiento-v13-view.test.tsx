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
    expect(rendered).toContain("Por qué no sabemos costo comparable");
    expect(rendered).toContain("Por qué no sabemos cupo disponible");
    expect(rendered).not.toMatch(zeroValue);
    expect(rendered).toContain("$650.000");
  });

  it("rotula lo indicativo como referencia y nunca como oferta aceptable", () => {
    const rendered = html();

    expect(rendered).toContain("Referencia indicativa");
    expect(rendered).toContain("no es una oferta");
    expect(rendered).toContain("no se puede aceptar desde Qavante");
    expect(rendered).toContain("La opción de no financiar");
  });

  it("publica estados, motivos y razones de cada alternativa", () => {
    const rendered = renderToStaticMarkup(
      <FinanciamientoV13View
        model={financingV13Model(overviewParcialV13, evaluationAbstenidaV13)}
      />,
    );

    expect(rendered).toContain("Estado de la evaluación · No evaluable");
    expect(rendered).toContain("Falta deuda verificada para esta entidad legal y moneda.");
    expect(rendered).toContain("Falta una oferta verificada para comparar esta alternativa.");
    expect(rendered).toContain(
      "El corte no muestra una brecha de caja que justifique financiarse.",
    );
    expect(rendered).toContain(
      "Motivos · Falta una oferta verificada para comparar esta alternativa.",
    );
    expect(rendered).toContain("Elegibilidad · Elegible");
    expect(rendered).toContain("Elegibilidad · Elegibilidad por verificar");
  });

  it("publica la elegibilidad recibida aunque el estado comparativo no cambie", () => {
    const alternative = evaluationV13.working_capital.alternatives[0]!;
    const rendered = evaluationHtml({
      ...evaluationV13,
      working_capital: {
        ...evaluationV13.working_capital,
        alternatives: [{ ...alternative, eligibility_state: "ineligible" }],
      },
    });

    expect(rendered).toContain("Comparable");
    expect(rendered).toContain("Elegibilidad · No elegible");
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

    expect(rendered).toContain("La fuente informó una limitación todavía no identificada.");
    expect(rendered).not.toContain("reviewer_unknown_code_237");
  });

  it("muestra combinaciones y cambios con sus cifras intactas", () => {
    const rendered = html(overviewCompletoV13);

    expect(rendered).toContain("Combinaciones verificadas");
    expect(rendered).toContain("Capital de trabajo + Refinanciamiento");
    expect(rendered).toContain("$5.000.000");
    expect(rendered).toContain("1 combinación excluida en esta evaluación");
    expect(rendered).toContain("Resultado limitado a 1 combinación");
    expect(rendered).toContain("Antes y después del refinanciamiento");
    expect(rendered).toContain("$116.924");
    expect(rendered).toContain("−$150.000");
    expect(rendered).toContain("+90 días");
    expect(rendered).toContain("Calendario actual · 1 pago · Calendario propuesto · 2 pagos");
    expect(rendered).toContain("Garantías agregadas · Garantía personal");
  });

  it("muestra la concentración exacta de cada combinación", () => {
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

    expect(rendered).toContain("Concentración de pagos");
    expect(rendered).toContain("$7.654.321");
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

    expect(rendered).toContain("Criterios de evaluación verificados");
    expect(rendered).not.toContain("regla_review_237");
    expect(rendered).not.toContain("policy:review:237");
  });

  it("muestra los objetos current y proposed completos del trade-off", () => {
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

    const actual = rendered.slice(rendered.indexOf(">Actual<"), rendered.indexOf(">Propuesto<"));
    const proposed = rendered.slice(
      rendered.indexOf(">Propuesto<"),
      rendered.indexOf("Cambio en costo total"),
    );

    expect(actual).toContain("$111.111");
    expect(actual).toContain("$122.222");
    expect(actual).toContain("144 días");
    expect(actual).toContain("Garantía actual única");
    expect(proposed).toContain("$211.111");
    expect(proposed).toContain("$222.222");
    expect(proposed).toContain("244 días");
    expect(proposed).toContain("Garantía propuesta única");
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

    expect(rendered).toContain("Detalle del calendario actual");
    expect(rendered).toContain("Detalle del calendario propuesto");
    expect(rendered).toContain("14-10-2026");
    expect(rendered).toContain("15-11-2026");
    expect(rendered).toContain("$341.987");
    expect(rendered).toContain("$428.765");
  });

  it("en estado completo publica la tasa y el cupo del backend", () => {
    const rendered = html(overviewCompletoV13);

    expect(rendered).toContain("1,4%");
    expect(rendered).toContain("$3.000.000");
    expect(rendered).toContain("Capacidad verificada · no es una oferta");
  });

  it("la tabla desplazable es alcanzable por teclado en móvil", () => {
    const rendered = html(overviewCompletoV13);

    expect(rendered).toContain('role="region"');
    expect(rendered).toContain('aria-label="Detalle desplazable de deuda vigente"');
    expect(rendered).toContain('tabindex="0"');
  });

  it("en abstención muestra motivos y ningún monto principal plausible", () => {
    const rendered = html(overviewAbstenidoV13, false);
    const knownPrincipal = /\$8\.503\.076/;

    expect(html(overviewCompletoV13)).toMatch(knownPrincipal);
    expect(rendered).toContain("todavía no puede recomendar");
    expect(rendered).toContain(
      "La deuda histórica no tiene una entidad legal y moneda reproducibles.",
    );
    expect(rendered).toContain("Por qué no sabemos deuda vigente");
    expect(rendered).toContain("Esto no afirma que tu deuda sea cero");
    expect(rendered).not.toMatch(knownPrincipal);
    expect(rendered).toContain("no acepta ofertas, no firma y no mueve");
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
