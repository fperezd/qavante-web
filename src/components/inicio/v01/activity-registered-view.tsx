import { CircleDot } from "lucide-react";
import { formatDateTimeLike } from "@/lib/formatters/date";
import type { ActividadRegistrada } from "./activity-registered-model";

export interface ActivityRegisteredViewProps {
  activities: readonly ActividadRegistrada[] | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

/** Cronología de hechos registrados: fuente explícita, sin prometer completitud ni Deshacer. */
export function ActivityRegisteredView({
  activities,
  loading = false,
  error = false,
  onRetry,
}: ActivityRegisteredViewProps) {
  if (loading) {
    return <p className="text-sm text-neutral-mid">Cargando actividad registrada (~2 s).</p>;
  }
  if (error) {
    return (
      <div className="space-y-2 text-sm text-neutral-mid" role="status">
        <p>
          No pudimos cargar los hechos registrados. No sabemos qué actividad hubo en estas fuentes.
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={LINK_BUTTON}>
            Reintentar
          </button>
        )}
      </div>
    );
  }
  if (!activities || activities.length === 0) {
    return (
      <p className="text-sm text-neutral-mid">
        Aún no hay hechos registrados en las fuentes disponibles.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-border" aria-label="Hechos registrados">
      {activities.map((activity) => (
        <li key={activity.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3 text-sm">
          <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-neutral-mid" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-neutral-dark">{activity.resumen}</p>
            <p className="mt-0.5 text-xs text-neutral-mid">
              Registrado el {formatDateTimeLike(activity.creadaEn)} · {activity.etiquetaFuente}
              {activity.resultado ? ` · Resultado: ${activity.resultado}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-mid">
            {activity.tipo}
          </span>
        </li>
      ))}
    </ol>
  );
}

const LINK_BUTTON =
  "rounded-md px-2 py-1 text-xs font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2";
