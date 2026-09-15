import { describe, expect, it } from "vitest";
import type { PulsoScoreReading } from "@/lib/api/pulso";
import { pulsoScoreReadingModel } from "./pulso-score-reading-model";

function reading(overrides: Partial<PulsoScoreReading> = {}): PulsoScoreReading {
  return {
    publication_state: "available",
    abstention_reason: null,
    focused_abstention_reason: null,
    legal_entity_id: "11111111-1111-1111-1111-111111111111",
    currency: "CLP",
    score_kind: "focused",
    objective_requested: "crecer",
    objective_applied: "crecer",
    objective_effective: true,
    base_score: 61,
    base_status: "stable",
    score: 67,
    status: "stable",
    delta_vs_base: 6,
    weights: [],
    coverage: { available_weight: 100, configured_weight: 100, ratio: 1 },
    omitted: [],
    knockout_code: null,
    knockout_cap: null,
    evaluation_id: "evaluation",
    input_snapshot_id: "snapshot",
    model_version: "PULSO-2.0",
    methodology_id: "PULSO-2.0+pulso-focus-personal-v1",
    calculated_at: "2026-09-13T12:00:00Z",
    data_as_of: "2026-09-13",
    status_thresholds: [],
    freshness_state: "unknown",
    freshness_reason: "source_lineage_not_available",
    ...overrides,
  };
}

describe("pulsoScoreReadingModel", () => {
  it("mantiene el Pulso base y separa el foco", () => {
    const model = pulsoScoreReadingModel(reading());
    expect(model.baseScore).toBe(61);
    expect(model.focusedScore).toBe(67);
    expect(model.focusLabel).toBe("Crecer");
    expect(model.delta).toBe(6);
  });

  it("explica la abstención de precisión sin sustituir el Pulso base", () => {
    const model = pulsoScoreReadingModel(
      reading({
        score: null,
        status: null,
        delta_vs_base: null,
        focused_abstention_reason: "focus_evidence_unavailable",
      }),
    );
    expect(model.baseScore).toBe(61);
    expect(model.focusUnavailable).toBe(true);
    expect(model.focusedScore).toBeNull();
  });

  it("declara el foco solicitado como no aplicado cuando el contrato no lo hizo efectivo", () => {
    const model = pulsoScoreReadingModel(
      reading({
        objective_requested: "crecer",
        objective_applied: "crecer",
        objective_effective: false,
        score_kind: "base",
        score: 61,
        status: "stable",
        delta_vs_base: 0,
      }),
    );
    expect(model.focusLabel).toBe("Crecer");
    expect(model.focusUnavailable).toBe(true);
    expect(model.focusedScore).toBeNull();
  });

  it("deriva los factores base sólo del mismo snapshot persistido", () => {
    const model = pulsoScoreReadingModel(
      reading({
        weights: [
          {
            key: "COB",
            score: 72,
            exact_score: 72.2,
            configured_weight: 40,
            multiplier: 1,
            raw_weight: 40,
            effective_weight: 40,
            contribution: 28.88,
          },
          {
            key: "RUN",
            score: null,
            configured_weight: 60,
            multiplier: 1,
            raw_weight: 60,
            effective_weight: 0,
            contribution: null,
          },
        ],
        omitted: ["RUN"],
      }),
    );
    expect(model.baseFactors).toEqual([
      { key: "COB", label: "Cobertura de pagos", score: 72, weight: 0.4 },
    ]);
    expect(model.omittedFactorLabels).toEqual(["Autonomía de caja"]);
  });

  it("no publica cifras si la empresa no es demostrable", () => {
    const model = pulsoScoreReadingModel(
      reading({
        publication_state: "abstained",
        abstention_reason: "unverified_entity_scope",
        base_score: null,
        base_status: null,
        score: null,
        status: null,
      }),
    );
    expect(model.state).toBe("unavailable");
    expect(model.unavailableReason).toMatch(/única empresa/i);
    expect(model.baseScore).toBeNull();
  });

  it("explica cuando todavía no existe un corte persistido", () => {
    const model = pulsoScoreReadingModel(
      reading({
        publication_state: "abstained",
        abstention_reason: "pulso_snapshot_unavailable",
        base_score: null,
        base_status: null,
        score: null,
        status: null,
      }),
    );
    expect(model.unavailableReason).toMatch(/corte verificable/i);
  });

  it("no llama al día a datos cuya evidencia de frescura aún falta", () => {
    expect(pulsoScoreReadingModel(reading()).freshnessLabel).toMatch(/no verificable/i);
  });

  it("sólo `fresh` acredita vigencia; cualquier otro estado dice que no se puede verificar", () => {
    const base = reading();
    expect(pulsoScoreReadingModel(base).freshnessLabel).toBe(
      "Vigencia de las fuentes no verificable.",
    );
    // Gemelo positivo: con `fresh` —y sólo con `fresh`— la lectura afirma la vigencia.
    const fresco = { ...base, freshness_state: "fresh" } as unknown as typeof base;
    expect(pulsoScoreReadingModel(fresco).freshnessLabel).toBe("Vigencia verificada.");
    for (const estado of ["unknown", "stale", "warning"]) {
      const degradado = { ...base, freshness_state: estado } as unknown as typeof base;
      expect(pulsoScoreReadingModel(degradado).freshnessLabel).toBe(
        "Vigencia de las fuentes no verificable.",
      );
    }
  });
});
