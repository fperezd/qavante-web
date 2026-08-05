import { Users } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { RemuneracionesView } from "@/components/remuneraciones/remuneraciones-view";

/* `/remuneraciones` — sección de Remuneraciones (RRHH / planilla) sobre el
   conector BUK. Dotación de empleados + totales de planilla del período.

   **Server Component** (como inicio/caja/mi-cuenta): resuelve `remuneraciones`
   en runtime del Worker. NO lleva "use client": el lookup de la flag usa una key
   computada (`NEXT_PUBLIC_FF_REMUNERACIONES`) que Next.js NO inlinea en el
   cliente → daría OFF siempre. `RemuneracionesView` es el Client Component que
   consume los datos.

   Flag OFF (default): QavanteEmpty informativo (patrón "MVP honesto" ADR-0013).
   Se activa en wrangler.toml cuando el conector BUK acepte cookie de sesión. */
export default async function RemuneracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { remuneraciones, payrollReconcileBoard } = resolveFeatureFlags();
  // Deep-link desde Pagar (ítem de nómina → su período). Solo YYYY-MM válido.
  const { period } = await searchParams;
  const initialPeriod = period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Remuneraciones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tu dotación de empleados y los totales de la planilla del mes.
        </p>
      </header>

      {remuneraciones ? (
        <RemuneracionesView
          initialPeriod={initialPeriod}
          reconcileBoardEnabled={payrollReconcileBoard}
        />
      ) : (
        <QavanteEmpty
          icon={Users}
          title="Remuneraciones — disponible pronto"
          description="Aquí vas a ver la dotación de empleados y los totales de la planilla del conector de Remuneraciones. Se habilita cuando se active la sección."
        />
      )}
    </div>
  );
}
