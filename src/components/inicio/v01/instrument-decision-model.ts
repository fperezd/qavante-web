import { parseAmountOrNull } from "@/lib/formatters/amount";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

/**
 * Boundary de presentación F4–F9.
 *
 * No es un contrato de red. F4–F8 sólo tienen contratos de dominio internos fusionados en
 * qavante-api#308/#309/#310; F9 (#304) aún no publica un reader estable. F3 usa su reader
 * público en `collection-evaluation-panel`. Estos adapters copian únicamente el subconjunto
 * exacto que la UI puede transportar de esos dominios.
 * Ningún tipo de este archivo autoriza un fetch, una selección o una ejecución.
 */
export type InstrumentEligibilityState =
  | "eligible"
  | "potentially_eligible"
  | "ineligible"
  | "not_evaluable";

export type InstrumentFamily =
  | "collection"
  | "working_capital"
  | "refinancing"
  | "fx"
  | "investment";

export type InstrumentTone = "neutral" | "info" | "warning" | "success";

export interface FinancingAlternativeAdapterSource {
  code: string;
  instrument_type: string;
  eligibility_state: InstrumentEligibilityState;
  reason_codes: readonly string[];
  is_no_action: boolean;
  evidence_refs: readonly string[];
  dimensions: {
    total_financial_cost: string | null;
  };
  offer: {
    currency: string;
    valid_through: string | null;
  } | null;
}

export interface FxAlternativeAdapterSource {
  code: "no_action" | "natural_netting" | "spot" | "forward";
  eligibility_state: InstrumentEligibilityState;
  reason_codes: readonly string[];
  commission_or_cost: string | null;
  commission_or_cost_currency: string | null;
  evidence_refs: readonly string[];
  is_no_action: boolean;
}

export interface FxQuoteTermsAdapterSource {
  valid_through: string;
}

export interface InvestmentAlternativeAdapterSource {
  code: "no_action" | "invest_surplus";
  product_ref: string | null;
  eligibility_state: InstrumentEligibilityState;
  reason_codes: readonly string[];
  total_cost: string | null;
  evidence_refs: readonly string[];
  is_no_action: boolean;
}

export interface InvestmentTermsAdapterSource {
  currency: string;
  valid_through: string;
}

export interface InstrumentAlternativeView {
  kind: "alternative";
  id: string;
  family: InstrumentFamily;
  familyLabel: string;
  title: string;
  code: string;
  eligibilityState: InstrumentEligibilityState;
  stateLabel: string;
  stateDescription: string;
  stateTone: InstrumentTone;
  isNoAction: boolean;
  costLabel: string;
  validityLabel: string;
  evidenceRefs: string[];
  reasonCodes: string[];
}

export interface ContractDependencyView {
  kind: "dependency";
  id: string;
  family: "collection" | "outcome_value_ledger";
  title: string;
  dependency: string;
  description: string;
}

export interface DecisionLayerView {
  instruments: Array<InstrumentAlternativeView | ContractDependencyView>;
  outcomeLedger: ContractDependencyView;
  externalDeliveryLabel: string;
}

const FAMILY_LABEL: Record<InstrumentFamily, string> = {
  collection: "Cobranza y reprogramación",
  working_capital: "Capital de trabajo",
  refinancing: "Refinanciamiento",
  fx: "FX y comercio exterior",
  investment: "Inversión de excedentes",
};

const STATE: Record<
  InstrumentEligibilityState,
  Pick<InstrumentAlternativeView, "stateLabel" | "stateDescription" | "stateTone">
> = {
  eligible: {
    stateLabel: "Elegible",
    stateDescription: "El contrato de dominio informó que la alternativa es elegible.",
    stateTone: "success",
  },
  potentially_eligible: {
    stateLabel: "Potencialmente elegible",
    stateDescription:
      "El contrato de dominio informó elegibilidad potencial; no equivale a elegible.",
    stateTone: "info",
  },
  ineligible: {
    stateLabel: "No elegible",
    stateDescription: "El contrato de dominio informó que la alternativa no es elegible.",
    stateTone: "neutral",
  },
  not_evaluable: {
    stateLabel: "No evaluable",
    stateDescription: "El contrato de dominio informó que la alternativa no es evaluable.",
    stateTone: "warning",
  },
};

function knownCostLabel(value: string | null, currency: string | null, label: string): string {
  const amount = parseAmountOrNull(value);
  if (amount == null || !currency) return "Costo no verificable";
  return `${label} ${formatMoney(amount, currency)}`;
}

function validityLabel(validThrough: string | null): string {
  return validThrough ? `Vigente hasta ${formatDateLike(validThrough)}` : "Vigencia no informada";
}

function noActionDetails() {
  return {
    title: "No actuar",
    costLabel: "Costo de instrumento no aplica",
    validityLabel: "Vigencia de instrumento no aplica",
  };
}

function baseAlternative(
  family: InstrumentFamily,
  code: string,
  eligibilityState: InstrumentEligibilityState,
  isNoAction: boolean,
  evidenceRefs: readonly string[],
  reasonCodes: readonly string[],
): Omit<InstrumentAlternativeView, "title" | "costLabel" | "validityLabel"> {
  return {
    kind: "alternative",
    id: `${family}:${code}`,
    family,
    familyLabel: FAMILY_LABEL[family],
    code,
    eligibilityState,
    ...STATE[eligibilityState],
    isNoAction,
    evidenceRefs: [...evidenceRefs],
    reasonCodes: [...reasonCodes],
  };
}

/** Adapter exacto del subconjunto común de F4/F5 fusionado en qavante-api#310. */
export function financingAlternativeView(
  family: "working_capital" | "refinancing",
  source: FinancingAlternativeAdapterSource,
): InstrumentAlternativeView {
  const base = baseAlternative(
    family,
    source.code,
    source.eligibility_state,
    source.is_no_action,
    source.evidence_refs,
    source.reason_codes,
  );
  if (source.is_no_action) return { ...base, ...noActionDetails() };
  return {
    ...base,
    title: FAMILY_LABEL[family],
    costLabel: knownCostLabel(
      source.dimensions.total_financial_cost,
      source.offer?.currency ?? null,
      "Costo financiero total",
    ),
    validityLabel: validityLabel(source.offer?.valid_through ?? null),
  };
}

/** Adapter exacto de F6 fusionado en qavante-api#308. La quote se entrega por separado. */
export function fxAlternativeView(
  source: FxAlternativeAdapterSource,
  quote: FxQuoteTermsAdapterSource | null,
): InstrumentAlternativeView {
  const base = baseAlternative(
    "fx",
    source.code,
    source.eligibility_state,
    source.is_no_action,
    source.evidence_refs,
    source.reason_codes,
  );
  if (source.is_no_action) return { ...base, ...noActionDetails() };
  return {
    ...base,
    title: FAMILY_LABEL.fx,
    costLabel: knownCostLabel(
      source.commission_or_cost,
      source.commission_or_cost_currency,
      "Costo o comisión",
    ),
    validityLabel: validityLabel(quote?.valid_through ?? null),
  };
}

/** Adapter exacto de F7 fusionado en qavante-api#308. Los términos conservan moneda/vigencia. */
export function investmentAlternativeView(
  source: InvestmentAlternativeAdapterSource,
  terms: InvestmentTermsAdapterSource | null,
): InstrumentAlternativeView {
  const base = baseAlternative(
    "investment",
    source.code,
    source.eligibility_state,
    source.is_no_action,
    source.evidence_refs,
    source.reason_codes,
  );
  if (source.is_no_action) return { ...base, ...noActionDetails() };
  return {
    ...base,
    title: FAMILY_LABEL.investment,
    costLabel: knownCostLabel(source.total_cost, terms?.currency ?? null, "Costo total"),
    validityLabel: validityLabel(terms?.valid_through ?? null),
  };
}

/** F9 sigue abierto; no hay importes, atribución ni confianza que el frontend pueda mostrar. */
export function outcomeLedgerContractDependencyView(): ContractDependencyView {
  return {
    kind: "dependency",
    id: "outcome-value-ledger:contract-pending",
    family: "outcome_value_ledger",
    title: "Resultado y Value Ledger",
    dependency: "qavante-api#304",
    description:
      "Contrato F9 público pendiente. Resultado y Value Ledger permanecen sin dato; unknown no es cero.",
  };
}

/** F8 fusionado declara todos sus adapters como disabled_no_institution. */
export function externalDeliveryDisabledLabel(activationState: "disabled_no_institution"): string {
  return activationState === "disabled_no_institution"
    ? "Integraciones externas deshabilitadas · sin envío ni ejecución"
    : "Integraciones externas deshabilitadas";
}
