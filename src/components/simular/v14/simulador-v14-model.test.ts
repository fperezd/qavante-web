import { describe, expect, it } from "vitest";
import {
  buildSimulationRequest,
  simulationSuggestions,
  simuladorV14Model,
  toSimulationRequestScope,
} from "./simulador-v14-model";
import { simulationPartialV14, simulationReadyV14 } from "./simulador-v14-fixtures";

const scope = {
  legal_entity_id: "20000000-0000-4000-8000-000000000014",
  currency: "CLP",
  as_of: "2026-09-09T12:00:00Z",
};
const readySources = simulationReadyV14.memo.sources ?? [];

describe("simuladorV14Model", () => {
  it("publica el signo que entregó el backend y no recompone el delta", () => {
    const model = simuladorV14Model(simulationReadyV14);
    const cash = model.impacts.find((item) => item.id === "cash");

    expect(cash?.before).toBe("$5.100.000");
    expect(cash?.after).toBe("$2.600.000");
    expect(cash?.delta).toBe("−$2.500.000");
  });

  it("sólo marca completa la respuesta ready/current con impactos y cinco bloques exactos", () => {
    const model = simuladorV14Model(simulationReadyV14);

    expect(model.structurallyComplete).toBe(true);
    expect(model.impacts.every((impact) => impact.state === "known")).toBe(true);
    expect(model.sources.every((source) => source.state === "current")).toBe(true);
  });

  it.each([
    ["omite el manifiesto", undefined],
    ["publica un manifiesto vacío", []],
    ["omite un bloque requerido", readySources.slice(0, -1)],
    [
      "duplica un bloque y oculta otro",
      [...readySources.slice(0, -1), ...readySources.slice(0, 1)],
    ],
  ])("no certifica completa cuando %s", (_case, sources) => {
    const contradictory = {
      ...simulationReadyV14,
      memo: { ...simulationReadyV14.memo, sources },
    };

    expect(simuladorV14Model(contradictory).structurallyComplete).toBe(false);
  });

  it("degrada un ready/current contradictorio si un impacto queda unknown", () => {
    const contradictory = {
      ...simulationReadyV14,
      memo: {
        ...simulationReadyV14.memo,
        margin: {
          state: "unknown" as const,
          before: null,
          after: null,
          delta: null,
          currency: null,
          reason_codes: ["margin_producer_unavailable"],
        },
      },
    };

    expect(simuladorV14Model(contradictory).structurallyComplete).toBe(false);
  });

  it("degrada un ready/current si una fuente publicada no está vigente", () => {
    const contradictory = {
      ...simulationReadyV14,
      memo: {
        ...simulationReadyV14.memo,
        sources: simulationReadyV14.memo.sources?.map((source) =>
          source.block === "policy"
            ? { ...source, state: "stale" as const, reason_codes: ["policy_stale"] }
            : source,
        ),
      },
    };

    const model = simuladorV14Model(contradictory);
    expect(model.structurallyComplete).toBe(false);
    expect(model.sources.find((source) => source.block === "policy")).toMatchObject({
      state: "stale",
      stateLabel: "Vencida",
    });
  });

  it("un impacto unknown permanece sin dato y nunca se aplasta a cero", () => {
    const model = simuladorV14Model(simulationPartialV14);
    const cash = model.impacts.find((item) => item.id === "cash");

    expect(cash).toMatchObject({ before: "Sin dato", after: "Sin dato", delta: "Sin dato" });
    expect(JSON.stringify(cash)).not.toContain("$0");
  });

  it("preserva las referencias baseline y del supuesto como evidencia separada", () => {
    expect(simuladorV14Model(simulationReadyV14).evidence).toEqual([
      "projection:baseline-2026-09-09",
      "user_assumption:suggestion.consultor",
    ]);
  });

  it("las sugerencias de caja quedan dentro del horizonte y ancladas al corte del servidor", () => {
    const suggestions = simulationSuggestions(scope.as_of, scope.currency);

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]?.assumption).toMatchObject({
      kind: "cash_outflow",
      effective_date: "2026-10-09",
      currency: "CLP",
    });
    expect(suggestions[0]?.question).toContain("$2,5M");
    expect(suggestions[1]?.question).toContain("$5M");
  });

  it("rotula USD y otras monedas sin cambiar la moneda del supuesto", () => {
    const usd = simulationSuggestions(scope.as_of, "USD");
    const eur = simulationSuggestions(scope.as_of, "EUR");

    expect(usd[0]?.question).toContain("US$2,5M");
    expect(usd[1]?.question).toContain("US$5M");
    expect(usd[0]?.assumption).toMatchObject({ amount: "2500000", currency: "USD" });
    expect(eur[0]?.question).toContain("EUR 2,5M");
    expect(eur[1]?.question).toContain("EUR 5M");
    expect(eur[0]?.assumption).toMatchObject({ amount: "2500000", currency: "EUR" });
  });

  it("INV-FX-001: rechaza un supuesto de caja en otra moneda", () => {
    const suggestion = simulationSuggestions(scope.as_of, "USD")[0]!;

    expect(buildSimulationRequest(scope, suggestion.question, suggestion.assumption)).toBeNull();
  });

  it("acepta el gemelo positivo en la moneda funcional sin sumar monedas", () => {
    const suggestion = simulationSuggestions(scope.as_of, scope.currency)[0]!;
    const request = buildSimulationRequest(scope, suggestion.question, suggestion.assumption);

    expect(request).toMatchObject({ currency: "CLP", horizon_days: 90 });
    expect(request?.assumptions).toEqual([suggestion.assumption]);
  });

  it("usa el timestamp del corte del servidor y no inventa una hora local", () => {
    expect(toSimulationRequestScope(scope, "2026-09-09T12:34:56Z")).toEqual({
      legal_entity_id: scope.legal_entity_id,
      currency: "CLP",
      as_of: "2026-09-09T12:34:56Z",
    });
    expect(toSimulationRequestScope(scope, "2026-09-10T12:34:56Z")).toBeNull();
    expect(toSimulationRequestScope(scope, "2026-09-09")).toBeNull();
  });
});
