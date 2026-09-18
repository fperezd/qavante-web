import { GestionCobrosLive } from "@/components/cobrar/gestion-cobros-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";
import { resolveFeatureFlags } from "@/lib/feature-flags";

export default function CobrarPage() {
  const { decisionBrief } = resolveFeatureFlags();
  return (
    <div className="space-y-6">
      {!decisionBrief && <p className="text-sm text-neutral-mid">Clientes con saldo</p>}
      {decisionBrief && <DecisionBriefSlot surface="cobrar" />}
      <GestionCobrosLive suppressRecommendations={decisionBrief} />
    </div>
  );
}
