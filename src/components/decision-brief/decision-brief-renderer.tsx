import { QavanteCard } from "@/components/qavante";
import type { CashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { DecisionBriefPanel } from "./decision-brief-panel";

/** La única versión generada y revisada para esta interfaz. */
export const CASH_DECISION_BRIEF_V1 = "cash-decision-brief.v1";

/**
 * Separa la selección de versión del panel V1. Cuando #559 publique V2 en
 * OpenAPI, se agrega su renderer aquí junto con fixtures y pruebas de contrato;
 * no se reinterpretan sus campos con la UI V1.
 */
export function supportsCashDecisionBriefV1(
  brief: Pick<CashDecisionBrief, "contract_version">,
): boolean {
  return (brief.contract_version as string) === CASH_DECISION_BRIEF_V1;
}

export function DecisionBriefRenderer({ brief }: { brief: CashDecisionBrief }) {
  if (!supportsCashDecisionBriefV1(brief)) {
    return <UnsupportedDecisionBriefContract version={brief.contract_version as string} />;
  }

  return <DecisionBriefPanel brief={brief} />;
}

function UnsupportedDecisionBriefContract({ version }: { version: string }) {
  return (
    <QavanteCard
      variant="bordered"
      data-testid="cash-decision-brief-unsupported-contract"
      data-contract-version={version}
    >
      <p className="text-sm font-medium text-neutral-dark">
        Esta decisión usa una versión que esta interfaz aún no puede presentar.
      </p>
      <p className="mt-1 text-sm text-neutral-mid">
        No mostramos una recomendación local mientras se actualiza la integración del contrato.
      </p>
    </QavanteCard>
  );
}
