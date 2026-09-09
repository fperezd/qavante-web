import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { simulationSuggestions, simuladorV14Model } from "./simulador-v14-model";
import {
  simulationAbstainedV14,
  simulationPartialV14,
  simulationReadyV14,
  simulationStaleV14,
} from "./simulador-v14-fixtures";
import { SimuladorV14View } from "./simulador-v14-view";

const suggestions = simulationSuggestions("2026-09-09T12:00:00Z", "CLP");
const noop = vi.fn();
const EM_DASH = /\u2014/u;

function html(
  response: typeof simulationReadyV14 | null,
  extra: Partial<React.ComponentProps<typeof SimuladorV14View>> = {},
) {
  return renderToStaticMarkup(
    <SimuladorV14View
      model={response ? simuladorV14Model(response) : null}
      suggestions={suggestions}
      onEvaluate={noop}
      {...extra}
    />,
  );
}

describe("SimuladorV14View", () => {
  it("normaliza todo el copy dinámico del memo sólo en el boundary visual", () => {
    const dynamic: typeof simulationReadyV14 = {
      ...simulationReadyV14,
      interpretation: "Interpretación — dinámica",
      memo: {
        ...simulationReadyV14.memo,
        verdict: "Veredicto — dinámico",
        condition: "Condición — dinámica",
        assumptions: [
          {
            ...simulationReadyV14.memo.assumptions[0]!,
            label: "Supuesto — dinámico",
          },
        ],
        evidence_refs: ["evidence — dinámica"],
        limitations: ["Limitación — dinámica"],
      },
    };
    const rawInputs = [
      dynamic.interpretation,
      dynamic.memo.verdict,
      dynamic.memo.condition,
      dynamic.memo.assumptions[0]?.label,
      dynamic.memo.evidence_refs?.[0],
      dynamic.memo.limitations?.[0],
    ];
    for (const rawInput of rawInputs) expect(rawInput).toMatch(EM_DASH);

    const rendered = html(dynamic);

    expect(rendered).not.toMatch(EM_DASH);
    expect(rendered).toContain("Interpretación · dinámica");
    expect(rendered).toContain("Veredicto · dinámico");
    expect(rendered).toContain("Condición · dinámica");
    expect(rendered).toContain("Supuesto · dinámico");
    expect(rendered).toContain("evidence · dinámica");
    expect(rendered).toContain("Limitación · dinámica");
    expect(JSON.stringify(dynamic)).toMatch(EM_DASH);
  });

  it("muestra el memo tipado, actual/propuesto, supuestos y evidencia exacta", () => {
    const rendered = html(simulationReadyV14);

    expect(rendered).toContain("Puedes asumir el gasto, con una condición");
    expect(rendered).toContain("Actual");
    expect(rendered).toContain("Propuesto");
    expect(rendered).toContain("−$1.234.567");
    expect(rendered).toContain("projection:baseline-2026-09-09");
    expect(rendered).toContain("user_assumption:suggestion.consultor");
    expect(rendered).toContain("Simulación · no ejecuta");
    expect(rendered).toContain("Guardar en memoria · no disponible");
  });

  it.each([
    ["ready", simulationReadyV14],
    ["partial", simulationPartialV14],
    ["abstained", simulationAbstainedV14],
    ["stale", simulationStaleV14],
  ])("Ley 2: %s no publica rojo", (_name, response) => {
    expect((html(response).match(/data-danger=/g) ?? []).length).toBe(0);
  });

  it("Ley 2: el error publica un único rojo y su gemelo positivo existe", () => {
    const rendered = html(null, { error: "Sin contexto verificable." });

    expect((rendered.match(/data-danger=/g) ?? []).length).toBe(1);
    expect(rendered).toContain("Sin contexto verificable");
  });

  it("normaliza el mensaje dinámico de error sólo en el boundary visual", () => {
    const rawError = { message: "Proveedor — respuesta dinámica" };
    expect(rawError.message).toMatch(EM_DASH);

    const rendered = html(null, { error: rawError.message });

    expect(rendered).not.toMatch(EM_DASH);
    expect(rendered).toContain("Proveedor · respuesta dinámica");
    expect(rawError.message).toBe("Proveedor — respuesta dinámica");
    expect(rawError.message).toMatch(EM_DASH);
  });

  it("la carga explica qué ocurre y no promete una ETA inventada", () => {
    const rendered = html(null, { loading: true });

    expect(rendered).toContain("Contrastando el supuesto");
    expect(rendered).toContain("no publica una ETA");
    expect(rendered).not.toContain("Todavía no hay un memo");
  });

  it("el vacío no presenta un resultado de ejemplo", () => {
    const rendered = html(null);

    expect(rendered).toContain("Todavía no hay un memo");
    expect(rendered).toContain("No mostramos un resultado de ejemplo");
    expect(rendered).not.toContain("Puedes asumir el gasto");
  });

  it("unknown y abstained quedan visibles, nunca como una recomendación completa", () => {
    const partial = html(simulationPartialV14);
    const abstained = html(simulationAbstainedV14);

    expect(partial).toContain("Evaluación parcial");
    expect(partial).toContain("Frescura sin dato");
    expect(partial).toContain("Sin dato");
    expect(abstained).toContain("El motor se abstuvo");
    expect(abstained).toContain("No puedo evaluar esta decisión");
  });

  it("no introduce el guion largo visible prohibido", () => {
    for (const response of [simulationReadyV14, simulationPartialV14, simulationAbstainedV14]) {
      expect(html(response)).not.toContain("—");
    }
  });
});
