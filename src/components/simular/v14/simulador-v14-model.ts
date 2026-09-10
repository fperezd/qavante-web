import type { components } from "@/lib/api/types";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike, formatDateTimeLike } from "@/lib/formatters/date";
import { formatPct } from "@/lib/formatters/pct";

export type SimulationRequest = components["schemas"]["SimulationEvaluateRequest"];
export type SimulationResponse = components["schemas"]["SimulationEvaluateResponse"];
type SimulationImpact = components["schemas"]["SimulationImpact"];
type SimulationAssumption = SimulationResponse["memo"]["assumptions"][number];
type SimulationSourceStatus = components["schemas"]["SimulationSourceStatus"];

export interface SimulationImpactView {
  id: "cash" | "margin" | "break-even";
  label: string;
  state: "known" | "unknown";
  before: string;
  after: string;
  delta: string;
  reasons: string[];
}

export interface SimulationSourceView {
  block: SimulationSourceStatus["block"];
  label: string;
  state: SimulationSourceStatus["state"];
  stateLabel: string;
  evidence: string[];
  reasons: string[];
}

export interface SimuladorV14Model {
  state: SimulationResponse["state"];
  structurallyComplete: boolean;
  contextContractVersion: SimulationResponse["context_contract_version"];
  verdict: string;
  interpretation: string;
  condition: string;
  freshness: SimulationResponse["memo"]["freshness"];
  freshnessLabel: string;
  scopeLabel: string;
  impacts: SimulationImpactView[];
  assumptions: string[];
  evidence: string[];
  sources: SimulationSourceView[];
  limitations: string[];
  saveAvailable: false;
  saveAdvertisedByApi: boolean;
  saveReasons: string[];
  evaluationHash: string;
}

const REASONS: Record<string, string> = {
  projection_context_unavailable: "La proyección base no está disponible.",
  projection_context_stale: "La proyección base está vencida.",
  simulation_context_unavailable: "Falta contexto financiero verificable.",
  unsupported_assumption: "Ese supuesto todavía no puede evaluarse.",
};

function reasonLabel(code: string): string {
  return REASONS[code] ?? `Limitación informada por el motor · código ${code}`;
}

function decimal(raw: string | null | undefined): number | null {
  if (typeof raw !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function impactValue(raw: string | null | undefined, currency: string | null | undefined): string {
  const value = decimal(raw);
  if (value === null) return "Sin dato";
  return currency ? formatMoney(value, currency) : `${raw} · unidad no informada`;
}

function impactView(
  id: SimulationImpactView["id"],
  label: string,
  impact: SimulationImpact,
): SimulationImpactView {
  if (impact.state !== "known") {
    return {
      id,
      label,
      state: "unknown",
      before: "Sin dato",
      after: "Sin dato",
      delta: "Sin dato",
      reasons: (impact.reason_codes ?? []).map(reasonLabel),
    };
  }
  return {
    id,
    label,
    state: "known",
    before: impactValue(impact.before, impact.currency),
    after: impactValue(impact.after, impact.currency),
    delta: impactValue(impact.delta, impact.currency),
    reasons: (impact.reason_codes ?? []).map(reasonLabel),
  };
}

function sourceLabel(block: SimulationSourceStatus["block"]): string {
  const labels: Partial<Record<SimulationSourceStatus["block"], string>> = {
    cash: "Caja",
    hard_reserves: "Reservas duras",
    policy: "Política de caja",
    margin: "Margen",
    break_even: "Punto de equilibrio",
  };
  return labels[block] ?? block;
}

function sourceStateLabel(state: SimulationSourceStatus["state"]): string {
  if (state === "current") return "Vigente";
  if (state === "stale") return "Vencida";
  return "Faltante";
}

function sourceView(source: SimulationSourceStatus): SimulationSourceView {
  return {
    block: source.block,
    label: sourceLabel(source.block),
    state: source.state,
    stateLabel: sourceStateLabel(source.state),
    evidence: source.evidence_refs ?? [],
    reasons: (source.reason_codes ?? []).map(reasonLabel),
  };
}

const REQUIRED_SOURCE_BLOCKS = [
  "cash",
  "hard_reserves",
  "policy",
  "margin",
  "break_even",
] as const satisfies readonly SimulationSourceStatus["block"][];

/** `ready` only means complete when the producer published each required block exactly
 * once and current. Missing, empty, partial and duplicated manifests are coverage gaps. */
function hasExactCurrentSources(
  sources: readonly SimulationSourceStatus[] | null | undefined,
): boolean {
  if (sources == null || sources.length !== REQUIRED_SOURCE_BLOCKS.length) return false;

  const blocks = new Set(sources.map((source) => source.block));
  return (
    blocks.size === REQUIRED_SOURCE_BLOCKS.length &&
    REQUIRED_SOURCE_BLOCKS.every((block) => blocks.has(block)) &&
    sources.every((source) => source.state === "current")
  );
}

/** Defensa de presentación, no cálculo financiero. Un `ready` contradictorio
 * nunca se pinta completo: los importes y la frescura siguen viniendo del backend. */
function isStructurallyComplete(response: SimulationResponse): boolean {
  const impacts = [response.memo.cash, response.memo.margin, response.memo.break_even];
  return (
    response.state === "ready" &&
    response.memo.freshness === "current" &&
    impacts.every((impact) => impact.state === "known") &&
    hasExactCurrentSources(response.memo.sources)
  );
}

function assumptionLabel(assumption: SimulationAssumption): string {
  if (assumption.kind === "cash_inflow" || assumption.kind === "cash_outflow") {
    const amount = decimal(assumption.amount);
    const formatted = amount === null ? "monto sin dato" : formatMoney(amount, assumption.currency);
    const direction = assumption.kind === "cash_inflow" ? "Entrada" : "Salida";
    return `${direction} · ${assumption.label} · ${formatted} · ${formatDateLike(assumption.effective_date)}`;
  }
  return "percent_change" in assumption
    ? `${assumption.label} · ${formatPct(Number(assumption.percent_change), { signed: true })} · ${assumption.kind}`
    : `${assumption.label} · supuesto sin detalle`;
}

export function simuladorV14Model(response: SimulationResponse): SimuladorV14Model {
  return {
    state: response.state,
    structurallyComplete: isStructurallyComplete(response),
    contextContractVersion: response.context_contract_version,
    verdict: response.memo.verdict,
    interpretation: response.interpretation,
    condition: response.memo.condition,
    freshness: response.memo.freshness,
    freshnessLabel:
      response.memo.freshness === "current"
        ? "Fuentes vigentes"
        : response.memo.freshness === "stale"
          ? "Fuentes vencidas"
          : "Frescura sin dato",
    scopeLabel: `${response.scope.currency} · corte ${formatDateTimeLike(response.scope.as_of)} · ${response.scope.horizon_days} días`,
    impacts: [
      impactView("cash", "Caja", response.memo.cash),
      impactView("margin", "Margen", response.memo.margin),
      impactView("break-even", "Punto de equilibrio", response.memo.break_even),
    ],
    assumptions: response.memo.assumptions.map(assumptionLabel),
    evidence: response.memo.evidence_refs ?? [],
    sources: (response.memo.sources ?? []).map(sourceView),
    limitations: response.memo.limitations ?? [],
    saveAvailable: false,
    saveAdvertisedByApi: response.save?.state === "available",
    saveReasons: response.save?.reason_codes?.map(reasonLabel) ?? [],
    evaluationHash: response.evaluation_hash,
  };
}

export interface Suggestion {
  id: string;
  question: string;
  assumption: SimulationRequest["assumptions"][number];
}

export interface SimulationRequestScope {
  legal_entity_id: string;
  currency: string;
  as_of: string;
}

function suggestionAmount(currency: string, amountInMillions: string): string {
  const displayCurrency = currency.trim().toUpperCase();
  if (displayCurrency === "CLP") return `$${amountInMillions}M`;
  if (displayCurrency === "USD") return `US$${amountInMillions}M`;
  return `${displayCurrency || "Moneda sin dato"} ${amountInMillions}M`;
}

/** Conserva entidad/moneda del scope canónico y la hora del corte del servidor.
 * Nunca completa el timestamp con el reloj del navegador. */
export function toSimulationRequestScope(
  scope: { legal_entity_id: string; currency: string; as_of: string } | null,
  generatedAt: string | null | undefined,
): SimulationRequestScope | null {
  if (!scope || typeof generatedAt !== "string") return null;
  const timestamp = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
    generatedAt,
  );
  if (!timestamp || timestamp[1] !== scope.as_of.slice(0, 10)) return null;
  return { legal_entity_id: scope.legal_entity_id, currency: scope.currency, as_of: generatedAt };
}

function addDays(iso: string, days: number): string | null {
  const date = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0];
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function simulationSuggestions(asOf: string, currency: string): Suggestion[] {
  const effectiveDate = addDays(asOf, 30);
  if (!effectiveDate) return [];
  const expenseAmount = suggestionAmount(currency, "2,5");
  const collectionAmount = suggestionAmount(currency, "5");
  return [
    {
      id: "consultor",
      question: `¿Puedo asumir un nuevo gasto de ${expenseAmount} en 30 días?`,
      assumption: {
        kind: "cash_outflow",
        assumption_id: "suggestion.consultor",
        label: "Nuevo gasto",
        amount: "2500000",
        effective_date: effectiveDate,
        currency,
      },
    },
    {
      id: "cobro",
      question: `¿Qué pasa si recibo un cobro de ${collectionAmount} en 30 días?`,
      assumption: {
        kind: "cash_inflow",
        assumption_id: "suggestion.cobro",
        label: "Cobro esperado",
        amount: "5000000",
        effective_date: effectiveDate,
        currency,
      },
    },
    {
      id: "ventas",
      question: "¿Qué pasa si mis ventas bajan 10%?",
      assumption: {
        kind: "revenue_change",
        assumption_id: "suggestion.ventas",
        label: "Cambio de ventas",
        percent_change: "-10",
      },
    },
  ];
}

export function buildSimulationRequest(
  scope: SimulationRequestScope,
  question: string,
  assumption: SimulationRequest["assumptions"][number],
): SimulationRequest | null {
  const clean = question.trim();
  if (!clean) return null;
  if (
    (assumption.kind === "cash_inflow" || assumption.kind === "cash_outflow") &&
    assumption.currency !== scope.currency
  ) {
    return null;
  }
  return {
    question: clean,
    legal_entity_id: scope.legal_entity_id,
    currency: scope.currency,
    as_of: scope.as_of,
    horizon_days: 90,
    assumptions: [assumption],
  };
}
