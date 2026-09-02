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
        <h1 className="text-2xl font-bold text-neutral-dark">Actividad reciente registrada</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Hechos persistidos por fuentes explícitas. No representa toda la actividad de tu empresa.
        </p>
      </header>

      <section aria-labelledby="actividad-registrada" className="space-y-2">
        <h2 id="actividad-registrada" className="text-lg font-semibold text-neutral-dark">
          Hechos registrados
        </h2>
        <p className="max-w-prose text-xs text-neutral-mid">
          Incluye sólo automatismos reversibles, eventos auditados y sincronizaciones que tengan
          una fila persistida. No infiere hechos ni confirma que no haya otros fuera de estas fuentes.
        </p>
        <ActivityRegisteredLive />
      </section>

      <section aria-labelledby="automatismos-reversibles" className="space-y-2">
        <h2 id="automatismos-reversibles" className="text-lg font-semibold text-neutral-dark">
          Automatismos reversibles
        </h2>
        <p className="max-w-prose text-xs text-neutral-mid">
          Este listado conserva las acciones de Qavante que todavía tienen Deshacer disponible.
        </p>
        <ActivityLogLive complete />
      </section>
    </div>
  );
}
