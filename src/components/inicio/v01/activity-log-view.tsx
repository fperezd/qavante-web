"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { RevertActionResponse } from "@/lib/api/reversible-actions";
import { formatDateTimeLike } from "@/lib/formatters/date";
import type { ActividadAutomatica } from "./activity-log-model";

export interface ActivityLogViewProps {
  activities: readonly ActividadAutomatica[] | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onUndo?: (actionId: string) => Promise<RevertActionResponse>;
  /** La portada enlaza cada acción a la bitácora completa; la ruta completa no se enlaza a sí misma. */
  detailLinks?: boolean;
  idPrefix?: string;
}

function mensajeDeshacer(result: RevertActionResponse): string {
  if (result.result === "reverted") return "Acción deshecha.";
  if (result.result === "already_reverted") return "Esta acción ya estaba deshecha.";
  if (result.result === "undo_expired") return "El plazo para deshacer esta acción venció.";
  if (result.result === "undo_not_supported") {
    return typeof result.detail?.explicacion === "string"
      ? result.detail.explicacion
      : "No pudimos confirmar que esta acción aún se pueda deshacer.";
  }
  return "No pudimos confirmar el resultado de Deshacer.";
}

/** Presenta el subconjunto disponible de Ley 5: automatismos reversibles, no actividad integral. */
export function ActivityLogView({
  activities,
  loading = false,
  error = false,
  onRetry,
  onUndo,
  detailLinks = false,
  idPrefix = "actividad",
}: ActivityLogViewProps) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function deshacer(actionId: string) {
    if (!onUndo) return;
    setPending(actionId);
    setNotice(null);
    try {
      setNotice(mensajeDeshacer(await onUndo(actionId)));
    } catch {
      setNotice("No pudimos enviar Deshacer. No confirmamos cambios; vuelve a intentarlo.");
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-neutral-mid">Estamos buscando lo que Qavante hizo solo (~2 s).</p>
    );
  }
  if (error) {
    return (
      <div className="space-y-2 text-sm text-neutral-mid" role="status">
        <p>No pudimos traer la bitácora de acciones automáticas. No sabemos qué hizo Qavante.</p>
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
        Aún no hay automatismos reversibles registrados dentro de su ventana de Deshacer.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {activities.map((activity) => (
        <div
          key={activity.actionId}
          id={`${idPrefix}-${activity.actionId}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm text-neutral-mid"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <strong className="text-neutral-dark">{activity.resumen}</strong>
            <span className="ml-1 text-xs">· {formatDateTimeLike(activity.creadaEn)}</span>
          </p>
          {activity.deshacerDisponible && onUndo && (
            <button
              type="button"
              onClick={() => void deshacer(activity.actionId)}
              disabled={pending === activity.actionId}
              className={LINK_BUTTON}
            >
              {pending === activity.actionId ? "Deshaciendo…" : "Deshacer"}
            </button>
          )}
          {!activity.deshacerDisponible && (
            <span className="shrink-0 text-xs text-neutral-mid">Deshacer no disponible ahora</span>
          )}
          {detailLinks && (
            <Link href={`/inicio/actividad#actividad-${activity.actionId}`} className={LINK_BUTTON}>
              Ver
            </Link>
          )}
        </div>
      ))}
      {notice && (
        <p className="pt-3 text-sm text-neutral-mid" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

const LINK_BUTTON =
  "shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-50";
