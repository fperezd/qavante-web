import { History } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { ActivityLogLive } from "@/components/inicio/v01/activity-log-live";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/** Lista completa DEL READER hoy publicado, no una actividad integral: ver límite visible abajo. */
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
        <h1 className="text-2xl font-bold text-neutral-dark">Automatismos reversibles</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Las acciones que Qavante ejecutó solo y que el backend registró con Deshacer.
        </p>
      </header>
      <ActivityLogLive complete />
      <p className="max-w-prose text-xs text-neutral-mid">
        Esta no es una actividad integral: no incluye sincronizaciones ni decisiones manuales, y
        sólo muestra automatismos que el backend publicó como reversibles. El reader completo de
        “Mientras no estabas” sigue en #65.
      </p>
    </div>
  );
}
