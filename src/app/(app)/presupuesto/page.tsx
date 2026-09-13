import { PiggyBank } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { PresupuestoView } from "@/components/presupuesto/presupuesto-view";
import { PresupuestoV09Live } from "@/components/presupuesto/v09/presupuesto-v09-live";

/* Presupuesto propositivo (ADR-0091, Fase 1a). Server Component: resuelve el flag `presupuesto`. El plan
   se PROPONE desde el histórico (no se llena a mano); el dueño lo ajusta con un gesto. Sin `export const
   runtime` (regla 4).

   V09 (flag `presupuestoV09`, issue #74, R1, OFF por defecto) reemplaza esta landing con la vista
   de la spec: tríada Plan/Real/Desvío + tabla de desvíos por concepto (ver
   `src/lib/feature-flags.ts` para el detalle de alcance y los huecos declarados). Con el flag OFF
   TODO lo de abajo queda exactamente igual → cero regresión, el patrón exacto de
   `pagarV05`/`gestionV08`/`remuneracionesV16`. */
export default function PresupuestoPage() {
  const { presupuesto, presupuestoV09 } = resolveFeatureFlags();

  if (presupuestoV09) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-rediseno-sans text-[28px] font-medium text-rediseno-tinta">
            Presupuesto
          </h1>
        </header>
        <PresupuestoV09Live issueSucesor={ISSUE_SUCESOR_V09} />
      </div>
    );
  }

  if (!presupuesto) {
    return (
      <QavanteEmpty
        icon={PiggyBank}
        title="Presupuesto"
        description="El presupuesto todavía no está disponible para esta empresa."
      />
    );
  }

  return <PresupuestoView />;
}

/** Huecos declarados de V09: drill-down monto→documentos + banner de proyección de cierre (ambos
 *  bloqueados por la misma decisión de forma del BO, ADR-0091 F1b — ver `feature-flags.ts`). */
const ISSUE_SUCESOR_V09 = "#101";
