import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

/**
 * Pure presentation boundary for F6, F7 and F9.
 *
 * It is deliberately not an OpenAPI contract: it only accepts a small, explicit
 * subset supplied by a future server-owned reader. It neither fetches, estimates,
 * converts currencies nor attributes outcomes in the browser.
 */
export type InstrumentReadState =
  "eligible" | "potentially_eligible" | "ineligible" | "not_evaluable";
export type InstrumentReadFamily = "fx" | "investment";
export type InstrumentReadTone = "default" | "info" | "warning" | "success";

export interface InstrumentReadSource {
  id: string;
  family: InstrumentReadFamily;
  code: string;
  state: InstrumentReadState;
  isNoAction: boolean;
  reasonCodes?: readonly string[];
  evidenceRefs?: readonly string[];
  cost?: string | null;
  costCurrency?: string | null;
  validThrough?: string | null;
}

export interface InstrumentReadView {
  id: string;
  familyLabel: string;
  code: string;
  state: InstrumentReadState;
  stateLabel: string;
  stateDescription: string;
  tone: InstrumentReadTone;
  isNoAction: boolean;
  costLabel: string;
  validityLabel: string;
  evidenceRefs: string[];
  reasonCodes: string[];
}

export interface OutcomeLedgerUnavailableView {
  title: string;
  description: string;
  outcomeLabel: string;
  valueLedgerLabel: string;
}

const FAMILY_LABEL: Record<InstrumentReadFamily, string> = {
  fx: "FX y comercio exterior",
  investment: "Inversión de excedentes",
};

const STATE: Record<
  InstrumentReadState,
  Pick<InstrumentReadView, "stateLabel" | "stateDescription" | "tone">
> = {
  eligible: {
    stateLabel: "Elegible",
    stateDescription: "El reader informó que la alternativa es elegible.",
    tone: "success",
  },
  potentially_eligible: {
    stateLabel: "Potencialmente elegible",
    stateDescription: "El reader informó elegibilidad potencial; no equivale a elegible.",
    tone: "info",
  },
  ineligible: {
    stateLabel: "No elegible",
    stateDescription: "El reader informó que la alternativa no es elegible.",
    tone: "default",
  },
  not_evaluable: {
    stateLabel: "No evaluable",
    stateDescription: "La evidencia disponible no permite evaluar esta alternativa.",
    tone: "warning",
  },
};

function costLabel(cost: string | null | undefined, currency: string | null | undefined): string {
  const amount = parseAmountOrNull(cost);
  return amount == null || !currency
    ? "Costo no verificable"
    : `Costo informado ${formatMoney(amount, currency)}`;
}

function validityLabel(validThrough: string | null | undefined): string {
  return validThrough ? `Vigente hasta ${formatDateLike(validThrough)}` : "Vigencia no informada";
}

/** Preserves reader states and unknown values without turning them into a recommendation or zero. */
export function instrumentReadView(source: InstrumentReadSource): InstrumentReadView {
  const base = {
    id: source.id,
    familyLabel: FAMILY_LABEL[source.family],
    code: source.code,
    state: source.state,
    ...STATE[source.state],
    isNoAction: source.isNoAction,
    evidenceRefs: [...(source.evidenceRefs ?? [])],
    reasonCodes: [...(source.reasonCodes ?? [])],
  };

  if (source.isNoAction) {
    return {
      ...base,
      costLabel: "Costo de instrumento no aplica",
      validityLabel: "Vigencia de instrumento no aplica",
    };
  }

  return {
    ...base,
    costLabel: costLabel(source.cost, source.costCurrency),
    validityLabel: validityLabel(source.validThrough),
  };
}

/** F9 cannot display an outcome, value or attribution until its public reader exists. */
export function outcomeLedgerUnavailableView(): OutcomeLedgerUnavailableView {
  return {
    title: "Resultado y Value Ledger",
    description:
      "Aún no hay un reader F9 público con resultado, atribución y evidencia verificables. No mostramos una estimación.",
    outcomeLabel: "Sin dato",
    valueLedgerLabel: "Sin dato",
  };
}
