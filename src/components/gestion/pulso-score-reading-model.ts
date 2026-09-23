import type { PulsoScoreReading } from "@/lib/api/pulso";
import { isPulsoObjetivo, objetivoOption, type PulsoObjetivo } from "./pulso-objetivo";

export interface PulsoBaseFactorModel {
  key: string;
  label: string;
  score: number;
  weight: number;
}

export interface PulsoScoreReadingModel {
  state: "available" | "unavailable";
  unavailableReason: string | null;
  baseScore: number | null;
  baseStatus: PulsoScoreReading["base_status"];
  focusLabel: string | null;
  focusedScore: number | null;
  focusedStatus: PulsoScoreReading["status"];
  delta: number | null;
  focusUnavailable: boolean;
  baseFactors: PulsoBaseFactorModel[];
  omittedFactorLabels: string[];
  freshnessLabel: string;
  methodologyLabel: string;
}

const ABSTENTION_COPY: Record<NonNullable<PulsoScoreReading["abstention_reason"]>, string> = {
  cash_balance_unavailable: "Falta un saldo de caja verificable para calcular el Pulso.",
  opening_balance_unavailable: "Falta un saldo de apertura verificable para calcular el Pulso.",
  insufficient_model_coverage:
    "La cobertura del modelo no alcanza para calcular el Pulso con seguridad.",
  pulso_snapshot_unavailable:
    "Todavía no existe un corte verificable del Pulso para esta empresa y moneda.",
  unverified_entity_scope:
    "No podemos atribuir el Pulso a una única empresa con los datos disponibles.",
};

const FACTOR_LABELS: Record<string, string> = {
  COB: "Cobertura de pagos",
  RUN: "Autonomía de caja",
  DPC: "Días de holgura",
  CAL: "Calidad de ingresos",
};

function factorLabel(key: string): string {
  return FACTOR_LABELS[key] ?? key;
}

export function pulsoScoreReadingModel(reading: PulsoScoreReading): PulsoScoreReadingModel {
  if (reading.publication_state === "abstained") {
    return {
      state: "unavailable",
      unavailableReason: reading.abstention_reason
        ? ABSTENTION_COPY[reading.abstention_reason]
        : "No hay evidencia suficiente para publicar el Pulso.",
      baseScore: null,
      baseStatus: null,
      focusLabel: null,
      focusedScore: null,
      focusedStatus: null,
      delta: null,
      focusUnavailable: false,
      baseFactors: [],
      omittedFactorLabels: [],
      freshnessLabel: "Vigencia de las fuentes no verificable.",
      methodologyLabel: `${reading.model_version} · ${reading.methodology_id}`,
    };
  }

  const focused = reading.objective_effective;
  const requestedObjective = isPulsoObjetivo(reading.objective_requested)
    ? reading.objective_requested
    : (reading.objective_applied as PulsoObjetivo);
  const focusRequested = requestedObjective !== "equilibrado";
  return {
    state: "available",
    unavailableReason: null,
    baseScore: reading.base_score,
    baseStatus: reading.base_status,
    focusLabel: focusRequested ? objetivoOption(requestedObjective).label : null,
    focusedScore: focused ? reading.score : null,
    focusedStatus: focused ? reading.status : null,
    delta: focused ? reading.delta_vs_base : null,
    focusUnavailable: focusRequested && (!focused || reading.focused_abstention_reason !== null),
    baseFactors: reading.weights.flatMap((factor) =>
      factor.score === null
        ? []
        : [
            {
              key: factor.key,
              label: factorLabel(factor.key),
              score: factor.score,
              weight: factor.configured_weight / 100,
            },
          ],
    ),
    omittedFactorLabels: reading.omitted.map(factorLabel),
    /* Sólo `fresh` acredita vigencia. Hoy el contrato D09 publica `unknown` como constante, pero
       el día que agregue `stale`/`warning` esta lectura NO puede decir "verificada" por defecto:
       se afirma la vigencia únicamente cuando el productor la declara fresca. */
    freshnessLabel:
      (reading.freshness_state as string) === "fresh"
        ? "Vigencia verificada."
        : "Vigencia de las fuentes no verificable.",
    methodologyLabel: `${reading.model_version} · ${reading.methodology_id}`,
  };
}
