import { PiggyBank } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PresupuestoView } from "@/components/presupuesto/presupuesto-view";

/* Presupuesto propositivo (ADR-0091, Fase 1a). Server Component: resuelve el flag `presupuesto`. El plan
   se PROPONE desde el histórico (no se llena a mano); el dueño lo ajusta con un gesto. Sin `export const
   runtime` (regla 4). */
export default function PresupuestoPage() {
  const { presupuesto } = resolveFeatureFlags();

  if (!presupuesto) {
    return (
      <QavanteEmpty
        icon={PiggyBank}
        title="Presupuesto"
        description="Muy pronto vas a ver acá cómo vas contra tu plan del año, un presupuesto que Qavante te propone desde tu historial, y avisos antes de que te pases."
      />
    );
  }

  return <PresupuestoView />;
}
