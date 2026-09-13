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
  it("normaliza narrativas y neutraliza referencias dinámicas en el límite visual", () => {
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
        sources: simulationReadyV14.memo.sources?.map((source, index) =>
          index === 0
            ? {
                ...source,
                evidence_refs: ["source evidence — dinámica"],
                reason_codes: ["source reason — dinámica"],
              }
            : source,
        ),
      },
    };
    const rawInputs = [
      dynamic.interpretation,
      dynamic.memo.verdict,
      dynamic.memo.condition,
      dynamic.memo.assumptions[0]?.label,
      dynamic.memo.evidence_refs?.[0],
      dynamic.memo.limitations?.[0],
      dynamic.memo.sources?.[0]?.evidence_refs?.[0],
      dynamic.memo.sources?.[0]?.reason_codes?.[0],
    ];
    for (const rawInput of rawInputs) expect(rawInput).toMatch(EM_DASH);

    const rendered = html(dynamic);

    expect(rendered).not.toMatch(EM_DASH);
    expect(rendered).toContain("Interpretación · dinámica");
    expect(rendered).toContain("Veredicto · dinámico");
    expect(rendered).toContain("Condición · dinámica");
    expect(rendered).toContain("Supuesto · dinámico");
    expect(rendered).toContain("Referencia de respaldo disponible");
    expect(rendered).toContain("Limitación · dinámica");
    expect(rendered).toContain("La fuente informó una limitación todavía no identificada.");
    expect(rendered).not.toContain("source evidence");
    expect(rendered).not.toContain("source reason");
    expect(JSON.stringify(dynamic)).toMatch(EM_DASH);
  });

  it("muestra el memo tipado, actual/propuesto, supuestos y evidencia exacta", () => {
    const rendered = html(simulationReadyV14);

    expect(rendered).toContain("Puedes asumir el gasto, con una condición");
    expect(rendered).toContain("Actual");
    expect(rendered).toContain("Propuesto");
    expect(rendered).toContain("−$2.500.000");
    expect(rendered).toContain("Proyección base utilizada");
    expect(rendered).toContain("Supuesto confirmado por el usuario");
    expect(rendered).toContain("Fuentes del contexto");
    expect(rendered).toContain("Política de caja");
    expect(rendered).toContain("Política de caja vigente");
    expect(rendered).toContain("Contexto evaluado · CLP");
    expect(rendered).not.toContain("cash-policy:v1");
    expect(rendered).not.toContain("Contrato de contexto");
    expect(rendered).toContain("Simulación · no ejecuta");
    expect(rendered).toContain("Guardar en memoria · aún no disponible");
    expect(rendered).toContain("El guardado está disponible por separado");
  });

  it("un ready/current contradictorio con impacto unknown se presenta parcial y ámbar", () => {
    const contradictory = {
      ...simulationReadyV14,
      memo: {
        ...simulationReadyV14.memo,
        break_even: {
          state: "unknown" as const,
          before: null,
          after: null,
          delta: null,
          currency: null,
          reason_codes: ["break_even_producer_unavailable"],
        },
      },
    };

    const rendered = html(contradictory);

    expect(rendered).toContain("Memo · Evaluación parcial");
    expect(rendered).not.toContain("Memo · Evaluación completa");
    expect(rendered).toContain("border-l-rediseno-ambar");
    expect(rendered).not.toContain("border-l-rediseno-verde");
  });

  it("un ready/current con fuente vencida tampoco se presenta completa", () => {
    const contradictory = {
      ...simulationReadyV14,
      memo: {
        ...simulationReadyV14.memo,
        sources: simulationReadyV14.memo.sources?.map((source) =>
          source.block === "policy" ? { ...source, state: "stale" as const } : source,
        ),
      },
    };

    const rendered = html(contradictory);

    expect(rendered).toContain("Memo · Evaluación parcial");
    expect(rendered).toContain("Política de caja");
    expect(rendered).toContain("Vencida");
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

  it("no imprime un diagnóstico técnico recibido como error", () => {
    const rendered = html(null, { error: "backend /api/simulations trace_id_123" });

    expect(rendered).toContain("La información necesaria no está disponible");
    expect(rendered).not.toContain("/api/simulations");
    expect(rendered).not.toContain("trace_id_123");
  });

  it("la carga explica qué ocurre y no promete una ETA inventada", () => {
    const rendered = html(null, { loading: true });

    expect(rendered).toContain("Contrastando el supuesto");
    expect(rendered).toContain("no informa un tiempo estimado");
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
    expect(abstained).toContain("No fue posible evaluar");
    expect(abstained).toContain("No puedo evaluar esta decisión");
  });

  it("no introduce el guion largo visible prohibido", () => {
    for (const response of [simulationReadyV14, simulationPartialV14, simulationAbstainedV14]) {
      expect(html(response)).not.toContain("—");
    }
  });
});
