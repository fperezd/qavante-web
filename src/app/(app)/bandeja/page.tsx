import { BandejaAuditLanding } from "@/components/bandeja/bandeja-audit-landing";
import { BandejaV07Live } from "@/components/bandeja/v07/bandeja-v07-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/**
 * Inicio y Caja son la entrada a la lectura financiera; Bandeja conserva la cola viva de auditoría
 * cuando V07 está habilitada. Con el flag apagado, la landing no inventa conteos ni estados.
 */
export default function BandejaPage() {
  const { bandejaV07, decisionBrief } = resolveFeatureFlags();

  if (bandejaV07) {
    return (
      <div className="space-y-6">
        {decisionBrief && <DecisionBriefSlot surface="bandeja" />}
        <BandejaV07Live secondaryAudit={decisionBrief} />
      </div>
    );
  }

  if (decisionBrief) {
    return (
      <div className="space-y-6">
        <DecisionBriefSlot surface="bandeja" />
        <BandejaAuditLanding />
      </div>
    );
  }

  return <BandejaAuditLanding />;
}
