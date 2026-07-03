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
export default function RemuneracionesPage() {
  const { remuneraciones } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Remuneraciones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tu dotación de empleados y los totales de la planilla del mes.
        </p>
      </header>

      {remuneraciones ? (
        <RemuneracionesView />
      ) : (
        <QavanteEmpty
          icon={Users}
          title="Remuneraciones — disponible pronto"
          description="Acá vas a ver la dotación de empleados y los totales de la planilla (haberes, descuentos y líquido) del conector de Remuneraciones. Se habilita cuando se active la sección."
        />
      )}
    </div>
  );
}
