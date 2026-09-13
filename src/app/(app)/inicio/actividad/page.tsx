import { History } from "lucide-react";
import { ActivityRegisteredLive } from "@/components/inicio/v01/activity-registered-live";
import { ActivityLogLive } from "@/components/inicio/v01/activity-log-live";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/** Pantalla separada de actividad registrada; conserva el reader reversible de Ley 5. */
export default function ActividadInicioPage() {
  const { hoyV01 } = resolveFeatureFlags();
  if (!hoyV01) {
    return (
      <QavanteEmpty
        icon={History}
        title="Bitácora de acciones automáticas"
        description="Esta bitácora se habilita junto con el nuevo Inicio cuando la validemos para tu empresa."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Actividad reciente</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Cambios y actualizaciones registrados por Qavante. Puede no incluir toda la actividad de
          tu empresa.
        </p>
      </header>

      <section aria-labelledby="actividad-registrada" className="space-y-2">
        <h2 id="actividad-registrada" className="text-lg font-semibold text-neutral-dark">
          Hechos registrados
        </h2>
        <p className="max-w-prose text-xs text-neutral-mid">
          Incluye acciones automáticas, cambios de negocio y actualizaciones confirmadas por las
          fuentes disponibles.
        </p>
        <ActivityRegisteredLive />
      </section>

      <section aria-labelledby="automatismos-reversibles" className="space-y-2">
        <h2 id="automatismos-reversibles" className="text-lg font-semibold text-neutral-dark">
          Acciones que puedes deshacer
        </h2>
        <p className="max-w-prose text-xs text-neutral-mid">
          Revisa las acciones automáticas y deshazlas cuando esa opción siga disponible.
        </p>
        <ActivityLogLive complete />
      </section>
    </div>
  );
}
