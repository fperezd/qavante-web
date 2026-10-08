/* Modelo PURO de Acuerdos financieros (web#178). Nada de fetch ni de React aquí: sólo
 * traducción de los 7 estados del contrato (api#386) a lo que la pantalla muestra. */
import type { FinancialAgreementListItem, FinancialAgreementState } from "@/lib/api/financial-agreements";
import { formatDateLike } from "@/lib/formatters/date";

export type AgreementStateVariant = "ok" | "warn" | "bad" | "mut" | "blue";

/** Nunca ambiguo: el BO debe poder distinguir "ya es vinculante" de "todavía se negocia"
 * con una sola mirada al pill, sin abrir el detalle. */
export function agreementStateLabel(state: FinancialAgreementState): string {
  switch (state) {
    case "negotiating":
      return "En negociación";
    case "offer_received":
      return "Oferta recibida";
    case "formalized":
      return "Formalizado";
    case "fulfilled":
      return "Cumplido";
    case "defaulted":
      return "Incumplido";
    case "terminated":
      return "Terminado";
    case "disputed":
      return "En disputa";
  }
}

export function agreementStateVariant(state: FinancialAgreementState): AgreementStateVariant {
  switch (state) {
    case "formalized":
    case "fulfilled":
      return "ok";
    case "negotiating":
    case "offer_received":
      return "mut";
    case "defaulted":
    case "disputed":
      return "bad";
    case "terminated":
      return "warn";
  }
}

/** Sólo `formalized` afecta algún escenario real (decisión de Fernando). Todo lo demás —
 * incluido un acuerdo YA cumplido o incumplido— es informativo o histórico en esta pantalla:
 * la sustitución en caja y en Pagar/Cobrar sólo vive mientras el acuerdo está `formalized`. */
export function agreementIsBinding(state: FinancialAgreementState): boolean {
  return state === "formalized";
}

export function agreementDirectionLabel(direction: "inflow" | "outflow"): string {
  return direction === "inflow" ? "Cobro" : "Pago";
}

export interface AgreementRowView {
  id: string;
  kindLabel: string;
  directionLabel: string;
  currencyCode: string;
  stateLabel: string;
  stateVariant: AgreementStateVariant;
  isBinding: boolean;
  stateChangedLabel: string;
}

export function agreementRowView(item: FinancialAgreementListItem): AgreementRowView {
  return {
    id: item.id,
    kindLabel: item.agreement_kind,
    directionLabel: agreementDirectionLabel(item.cash_direction),
    currencyCode: item.currency_code,
    stateLabel: agreementStateLabel(item.state),
    stateVariant: agreementStateVariant(item.state),
    isBinding: agreementIsBinding(item.state),
    stateChangedLabel: formatDateLike(item.state_changed_at),
  };
}
