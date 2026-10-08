/* Modelo PURO del detalle de un acuerdo (web#178). */
import { formatDateLike, formatDateTimeLike } from "@/lib/formatters/date";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import type {
  FinancialAgreementDetailResponse,
  FinancialAgreementEventResponse,
} from "@/lib/api/financial-agreements";
import { agreementDirectionLabel, agreementStateLabel, agreementStateVariant } from "./acuerdos-model";

export interface ScheduleRowView {
  sequence: number;
  dueDateLabel: string;
  amountLabel: string;
}

export interface SubjectRowView {
  kind: string;
  reference: string;
  coveredAmountLabel: string;
}

export interface EventRowView {
  sequence: number;
  stateLabel: string;
  stateVariant: ReturnType<typeof agreementStateVariant>;
  occurredAtLabel: string;
  reason: string | null;
}

export interface AgreementDetailView {
  id: string;
  kindLabel: string;
  directionLabel: string;
  currencyCode: string;
  stateLabel: string;
  stateVariant: ReturnType<typeof agreementStateVariant>;
  isFormalized: boolean;
  canFormalize: boolean;
  subjects: SubjectRowView[];
  schedule: ScheduleRowView[] | null;
  agreedTotalLabel: string | null;
  externalReference: string | null;
  events: EventRowView[];
}

const SUBJECT_KIND_LABEL: Record<string, string> = {
  payable: "Cuenta por pagar",
  receivable: "Cuenta por cobrar",
  obligation: "Obligación",
  payroll: "Remuneraciones",
  tax: "Impuesto",
  settlement: "Liquidación",
  other: "Otro",
};

export function agreementDetailView(agreement: FinancialAgreementDetailResponse): AgreementDetailView {
  const isFormalized = agreement.state === "formalized";
  return {
    id: agreement.id,
    kindLabel: agreement.agreement_kind,
    directionLabel: agreementDirectionLabel(agreement.cash_direction),
    currencyCode: agreement.currency_code,
    stateLabel: agreementStateLabel(agreement.state),
    stateVariant: agreementStateVariant(agreement.state),
    isFormalized,
    canFormalize: agreement.state === "negotiating" || agreement.state === "offer_received",
    subjects: agreement.subjects.map((subject) => ({
      kind: SUBJECT_KIND_LABEL[subject.kind] ?? subject.kind,
      reference: subject.source_id ?? subject.external_reference ?? "s/d",
      coveredAmountLabel:
        formatMoneyFromDecimalString(subject.covered_amount, agreement.currency_code) ?? "s/d",
    })),
    schedule: agreement.latest_terms
      ? agreement.latest_terms.schedule.map((item) => ({
          sequence: item.sequence,
          dueDateLabel: formatDateLike(item.due_date),
          amountLabel: formatMoneyFromDecimalString(item.amount, agreement.currency_code) ?? "s/d",
        }))
      : null,
    agreedTotalLabel: agreement.latest_terms
      ? formatMoneyFromDecimalString(agreement.latest_terms.agreed_total_amount, agreement.currency_code)
      : null,
    externalReference: agreement.latest_terms?.external_reference ?? null,
    events: agreement.events.map((event: FinancialAgreementEventResponse) => ({
      sequence: event.event_sequence,
      stateLabel: agreementStateLabel(event.to_state),
      stateVariant: agreementStateVariant(event.to_state),
      occurredAtLabel: formatDateTimeLike(event.occurred_at),
      reason: event.reason ?? null,
    })),
  };
}
