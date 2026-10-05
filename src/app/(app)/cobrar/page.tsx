import { DirectorioDeudores } from "@/components/cobrar/directorio-deudores";
import { GestionCobrosLive } from "@/components/cobrar/gestion-cobros-live";
import { DecisionBriefSlot } from "@/components/decision-brief/decision-brief-slot";
import { resolveFeatureFlags } from "@/lib/feature-flags";

export default function CobrarPage() {
  const { decisionBrief, cobrarDirectorioDeudores } = resolveFeatureFlags();
  return (
    <div className="space-y-6">
      {!decisionBrief && <p className="text-sm text-neutral-mid">Clientes con saldo</p>}
      {decisionBrief && <DecisionBriefSlot surface="cobrar" />}
      <GestionCobrosLive suppressRecommendations={decisionBrief} />
      {/* El directorio va DESPUÉS de la lista de documentos y no en lugar de ella: son dos granos
          distintos de la misma cartera. Arriba, documento por documento, que es con lo que se
          manda un recordatorio; acá, cliente por cliente, que es con lo que se decide a quién
          llamar. Con el flag en OFF esta sección no se monta y Cobrar queda igual que antes. */}
      {cobrarDirectorioDeudores && <DirectorioDeudores />}
    </div>
  );
}
